import { useEffect, useState } from "react"
import { isTruthy } from "remeda"
import {
	combineLatest,
	distinctUntilChanged,
	EMPTY,
	filter,
	map,
	merge,
	type Observable,
	of,
	scan,
	shareReplay,
	skip,
	startWith,
	switchMap,
	take,
	withLatestFrom
} from "rxjs"
import { match, P } from "ts-pattern"
import { callAll } from "#/helpers"
import { appState$ } from "#/state/state"
import { getKeybindsWhen } from "#/state/stateUtils"
import {
	type KeybindCommand,
	type KeybindCommandWhen,
	type KeybindNextUp,
	keybindsState
} from "./keybindsState"
import { type KeyPressEvent, keys$ as keyEvents$ } from "./keysStream"
import type { KeyEvent } from "@opentui/core"
import type { GeneralCommand } from "#/commands/appCommands"
import type { KeyBinding, KeyInput } from "#/lib/keybinds"

type CallbacksOrSequence =
	| { type: "callbacks"; callbacks: readonly KeybindCommand["callback"][] }
	| { type: "sequence"; sequence: SequencePart }
export type SequencePart = {
	pressed: KeyBinding
	nextUp: readonly KeybindNextUp[]
}

const areKeybindingsDisabled$: Observable<boolean> = appState$.pipe(
	map((state) => state.focusedInputs.length > 0),
	startWith(false),
	distinctUntilChanged(),
	shareReplay({ refCount: true, bufferSize: 1 })
)

const keybindingWhen$: Observable<KeybindCommandWhen> = appState$.pipe(
	map((state) => getKeybindsWhen(state.keybindingWhen)),
	startWith("default" satisfies KeybindCommandWhen as KeybindCommandWhen),
	distinctUntilChanged(),
	shareReplay({ refCount: true, bufferSize: 1 })
)

const pressed$: Observable<KeyPressEvent> = keyEvents$.pipe(
	filter((event): event is KeyPressEvent => event.type === "keypress")
)

const keySequenceResult$: Observable<CallbacksOrSequence | undefined> =
	pressed$.pipe(
		withLatestFrom(areKeybindingsDisabled$),
		filter(([_, isDisabled]) => !isDisabled),
		map(([keypress]) => openTuiInputToKeyInput(keypress.event)),
		withLatestFrom(keybindingWhen$),
		switchMap(([input, when]) => {
			const sequenceReset$ = merge(
				// TODO figure out why this is not working properly.
				// If we use any number smaller than 3 sequenced keybinds stop working after opening and closing the runner
				keybindingWhen$.pipe(skip(5), distinctUntilChanged()),
				areKeybindingsDisabled$.pipe(skip(5), distinctUntilChanged())
			).pipe(map(() => ({ input: undefined, when })))

			return sequenceReset$.pipe(startWith({ input, when }))
		}),
		scan(
			reduceToCommandAndSequences,
			undefined as CallbacksOrSequence | undefined
		),
		distinctUntilChanged()
	)

export function handleKeybinds() {
	const subscription = keySequenceResult$.subscribe((inputResult) => {
		if (inputResult?.type !== "callbacks") return

		callAll(inputResult.callbacks)
	})

	return () => subscription.unsubscribe()
}

/**
 * This is currently only for global keybinds.
 * All configurable keybinds are global right now.
 */
export function useGetNextKeySequence(): SequencePart | undefined {
	const [nextUpCommands, setKeySequence] = useState<SequencePart | undefined>(
		undefined
	)

	useEffect(() => {
		const subscription = keySequenceResult$.subscribe((inputResult) => {
			const sequenceMaybe =
				inputResult?.type === "sequence" ? inputResult.sequence : undefined

			setKeySequence(sequenceMaybe)
		})

		return () => subscription.unsubscribe()
	}, [])

	return nextUpCommands
}

function reduceToCommandAndSequences(
	previous: CallbacksOrSequence | undefined,
	{
		input,
		when
	}: {
		when: KeybindCommandWhen
		input: KeyInput | undefined
	}
): CallbacksOrSequence | undefined {
	if (
		// Input gets set to undefined if it is disabled
		input === undefined
	) {
		return undefined
	}

	return (
		match(previous)
			.returnType<CallbacksOrSequence | undefined>()

			// If "callbacks" are returned, those will be called.
			// The next scan will receive those, but that just means that
			// the reducer should start from scratch again as the previous sequence completed
			.with(P.union(undefined, { type: "callbacks" }), () => {
				const callbacks = keybindsState
					.getCommandsForKeys([input])
					.flatMap(({ callback, when: thisWhen }) =>
						thisWhen === when ? callback : []
					)

				return callbacks.length > 0
					? { type: "callbacks", callbacks }
					: ({
							type: "sequence",
							sequence: {
								pressed: [input],
								nextUp: keybindsState.getNextUp([input])
							}
						} satisfies CallbacksOrSequence)
			})

			.with(
				{ type: "sequence" },
				({ sequence: { pressed: previousPressed } }) => {
					const pressed = [...previousPressed, input]
					const callbacks = keybindsState
						.getCommandsForKeys(pressed)
						.map(({ callback }) => callback)

					if (callbacks.length > 0) {
						return { type: "callbacks", callbacks } as const
					}

					const nextUp = keybindsState.getNextUp(pressed)

					if (nextUp.length > 0) {
						return {
							type: "sequence",
							sequence: {
								pressed,
								nextUp: keybindsState.getNextUp(pressed)
							}
						} as const satisfies CallbacksOrSequence
					}

					return undefined
				}
			)
			.exhaustive()
	)
}

const isLatinLetterRegex = /[a-z]/

function openTuiInputToKeyInput(event: KeyEvent): KeyInput {
	const { ctrl, option, shift, name } = event

	// open-tui always gives the lowercase version of letters. Dunno why
	const shouldUppercase = shift && isLatinLetterRegex.test(name)
	const key = shouldUppercase ? name.toUpperCase() : name

	const modifiers: KeyInput["modifiers"] = [
		ctrl && ("ctrl" as const),
		option && ("alt" as const),
		shift && !shouldUppercase && ("shift" as const)
	].filter(isTruthy)

	return { key, modifiers }
}

export type GeneralCommandArgument = Omit<GeneralCommand, "when">

/** Returns the unregister function */
export function registerKeybinds(
	toRegister: readonly GeneralCommandArgument[],
	options?: { when: KeybindCommandWhen }
) {
	toRegister.forEach(({ keybindings, label, callback, id }) =>
		keybindings.forEach((sequence) => {
			keybindsState.addSequence(sequence, {
				callback,
				id,
				label,
				when: options?.when ?? "default"
			})
		})
	)

	return () => unregisterKeybinds(toRegister)
}

export function unregisterKeybinds(
	toUnregister: readonly GeneralCommandArgument[]
) {
	toUnregister.forEach(({ keybindings, id }) =>
		// a command can have multiple keybindings
		keybindings.forEach((sequence) =>
			keybindsState.removeSequence(sequence, id)
		)
	)
}
