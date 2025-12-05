import { useEffect, useState } from "react"
import { isTruthy } from "remeda"
import {
	distinctUntilChanged,
	filter,
	map,
	type Observable,
	scan,
	shareReplay,
	startWith,
	withLatestFrom
} from "rxjs"
import { match, P } from "ts-pattern"
import { callAll } from "#/helpers"
import { appState$ } from "#/state/state"
import {
	type KeybindCommand,
	type KeybindNextUp,
	keybindsState
} from "./keybindsState"
import { type KeyTypeData, keys$ as keyEvents$ } from "./keysStream"
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
	map((state) => state.modals.length > 0),
	startWith(false),
	distinctUntilChanged(),
	shareReplay()
)

const keySequenceResult$: Observable<CallbacksOrSequence | undefined> =
	keyEvents$.pipe(
		withLatestFrom(areKeybindingsDisabled$),
		filter(([_, isDisabled]) => !isDisabled),
		map(([event]) => event),
		filter(
			(data): data is { type: "keypress" } & KeyTypeData =>
				data.type === "keypress"
		),
		map((keypress) => keypress.event),
		map(openTuiInputToKeyInput),
		scan(reduceInputs, undefined),
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

function reduceInputs(
	previousCommandOrSequenceMaybe: CallbacksOrSequence | undefined,
	input: KeyInput
): CallbacksOrSequence | undefined {
	return match(previousCommandOrSequenceMaybe)
		.returnType<CallbacksOrSequence | undefined>()

		.with(P.union(undefined, { type: "callbacks" }), () => {
			const callbacks = keybindsState
				.getCommandsForKeys([input])
				.map(({ callback }) => callback)

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

/** Returns the unregister function */
export function registerKeybinds(toRegister: readonly GeneralCommand[]) {
	toRegister.forEach(({ keybindings, label, callback, id }) =>
		keybindings.forEach((sequence) =>
			keybindsState.addSequence(sequence, { callback, id, label })
		)
	)

	return () => unregisterKeybinds(toRegister)
}
export function unregisterKeybinds(toUnregister: readonly GeneralCommand[]) {
	toUnregister.forEach(({ keybindings, id }) =>
		// a command can have multiple keybindings
		keybindings.forEach((sequence) =>
			keybindsState.removeSequence(sequence, id)
		)
	)
}
