import { useEffect, useState } from "react"
import { isTruthy } from "remeda"
import {
	distinctUntilChanged,
	filter,
	map,
	merge,
	scan,
	shareReplay,
	skip,
	startWith,
	switchMap,
	withLatestFrom
} from "rxjs"
import { match, P } from "ts-pattern"
import { useAppContext } from "#/app/context"
import { callAll } from "#/shared/helpers"
import { getKeybindsWhen } from "#/core/state/stateUtils"
import type { KeyEvent } from "@opentui/core"
import type { GeneralCommand } from "#/core/commands/appCommands"
import type { KeyBinding, KeyInput } from "#/shared/lib/keybinds"
import type { AppState } from "#/core/state/types"
import type { Observable } from "rxjs"
import type {
	KeybindCommand,
	KeybindCommandMap,
	KeybindCommandWhen,
	KeybindNextUp
} from "./keybindsState"
import type { KeyPressEvent, KeyTypeData } from "./keysStream"

type CallbacksOrSequence =
	| { type: "callbacks"; callbacks: readonly KeybindCommand["callback"][] }
	| { type: "sequence"; sequence: SequencePart }
export type SequencePart = {
	pressed: KeyBinding
	nextUp: readonly KeybindNextUp[]
}

export type KeybindManagerDeps = {
	readonly appState$: Observable<AppState>
	readonly keybindsState: KeybindsTrie
	readonly keys$: Observable<KeyTypeData>
}

/** Subset of KeybindTrie that the manager needs */
type KeybindsTrie = {
	readonly getCommandsForKeys: (
		sequence: KeyBinding
	) => readonly KeybindCommand[]
	readonly getNextUp: (sequence: KeyBinding) => readonly KeybindNextUp[]
	readonly addSequence: (sequence: KeyBinding, command: KeybindCommand) => void
	readonly removeSequence: (sequence: KeyBinding, id: string) => void
	readonly getAllCommands: () => KeybindCommandMap
}

export type KeybindManager = {
	readonly handleKeybinds: () => () => void
	readonly registerKeybinds: (
		toRegister: readonly GeneralCommandArgument[],
		options?: { when: KeybindCommandWhen }
	) => () => void
	readonly unregisterKeybinds: (
		toUnregister: readonly GeneralCommandArgument[]
	) => void
	readonly keySequenceResult$: Observable<CallbacksOrSequence | undefined>
	readonly getAllCommands: () => KeybindCommandMap
}

/** Creates a keybind manager with injected dependencies */
export function createKeybindManager({
	appState$,
	keybindsState,
	keys$
}: KeybindManagerDeps): KeybindManager {
	const areKeybindingsDisabled$: Observable<boolean> = appState$.pipe(
		map((state) => state.focusedInputs.length > 0),
		startWith(false),
		distinctUntilChanged(),
		shareReplay({ refCount: false, bufferSize: 1 })
	)

	const keybindingWhen$: Observable<KeybindCommandWhen> = appState$.pipe(
		map((state) => getKeybindsWhen(state.keybindingWhen)),
		startWith("default" satisfies KeybindCommandWhen as KeybindCommandWhen),
		distinctUntilChanged(),
		shareReplay({ refCount: false, bufferSize: 1 })
	)

	const pressed$: Observable<KeyPressEvent> = keys$.pipe(
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
				(previous, current) =>
					reduceToCommandAndSequences(keybindsState, previous, current),
				undefined as CallbacksOrSequence | undefined
			),
			distinctUntilChanged()
		)

	function handleKeybinds() {
		const subscription = keySequenceResult$.subscribe((inputResult) => {
			if (inputResult?.type !== "callbacks") return

			callAll(inputResult.callbacks)
		})

		return () => subscription.unsubscribe()
	}

	function registerKeybinds(
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

	function unregisterKeybinds(toUnregister: readonly GeneralCommandArgument[]) {
		toUnregister.forEach(({ keybindings, id }) =>
			keybindings.forEach((sequence) =>
				keybindsState.removeSequence(sequence, id)
			)
		)
	}

	return {
		handleKeybinds,
		registerKeybinds,
		unregisterKeybinds,
		keySequenceResult$,
		getAllCommands: () => keybindsState.getAllCommands()
	}
}

/** Hook that subscribes to the key sequence result and returns the current sequence part */
export function useGetNextKeySequence(): SequencePart | undefined {
	const { keybindManager } = useAppContext()
	const [nextUpCommands, setKeySequence] = useState<SequencePart | undefined>(
		undefined
	)

	useEffect(() => {
		const subscription = keybindManager.keySequenceResult$.subscribe(
			(inputResult) => {
				const sequenceMaybe =
					inputResult?.type === "sequence" ? inputResult.sequence : undefined

				setKeySequence(sequenceMaybe)
			}
		)

		return () => subscription.unsubscribe()
	}, [keybindManager.keySequenceResult$])

	return nextUpCommands
}

function reduceToCommandAndSequences(
	keybindsState: KeybindsTrie,
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
