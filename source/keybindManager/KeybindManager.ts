import { useEffect, useState } from "react"
import { isTruthy } from "remeda"
import { Subject, map, scan } from "rxjs"
import { P, match } from "ts-pattern"
import { type Key, useInput } from "tuir"
import type { AppCommand, GeneralCommand } from "#/commands/appCommands"
import type { KeyBinding, KeyInput } from "#/config/shortcutParser"
import {
	type KeybindCommand,
	type KeybindNextUp,
	keybindsState
} from "./keybindsState"
import { logg } from "#/logs"

/** This is a mirror of the internal `SpecialKeys`,
 * which does not get exported, but used in `useInput` */
type SpecialKeySet = Omit<Record<keyof typeof Key | "ctrl", boolean>, "sigint">
type InputData = { key: string; specialKeys: SpecialKeySet }
type CallbacksOrSequence =
	| { type: "callbacks"; callbacks: readonly KeybindCommand["callback"][] }
	| { type: "sequence"; sequence: SequencePart }
export type SequencePart = {
	pressed: KeyBinding
	nextUp: readonly KeybindNextUp[]
}

/**
 * This is currently only for global keybinds.
 * All configurable keybinds are global right now.
 *
 * Later we want to support multiple instances of this,
 * in different contexts (like the 'when' property in VS Code keybinds)
 */
export function manageKeybinds(): SequencePart | undefined {
	const [inputs$] = useState(new Subject<InputData>())
	const [nextUpCommands, setKeySequence] = useState<SequencePart | undefined>(
		undefined
	)

	useInput((key, specialKeys) => inputs$.next({ key, specialKeys }))

	useEffect(() => {
		const subscription = inputs$
			.pipe(
				map(tuirInputToKeyInput),

				scan(reduceInputs, undefined as CallbacksOrSequence | undefined)
			)
			.subscribe((inputResult) => {
				const sequencePart =
					inputResult === undefined || inputResult.type === "callbacks"
						? undefined
						: inputResult.sequence

				setKeySequence(sequencePart && sequencePart)

				if (inputResult?.type === "callbacks") {
					inputResult.callbacks.forEach((callback) => callback())
				}
			})

		return () => subscription.unsubscribe()
	}, [inputs$])

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

const altKeycode = "\u001b"

function tuirInputToKeyInput({ key, specialKeys }: InputData): KeyInput {
	const modifiers: KeyInput["modifiers"] = [
		key.startsWith(altKeycode) && ("alt" as const),
		// for some reason ctrl is always true when pressing tab
		specialKeys.ctrl && !specialKeys.tab && ("ctrl" as const)
	].filter(isTruthy)

	const specialKeysArray = Object.entries(specialKeys) as [
		keyof SpecialKeySet,
		boolean
	][]

	const input =
		specialKeysArray.find(
			([specialKey, isSet]) => isSet && specialKey !== "ctrl"
		)?.[0] ?? //
		key.replace(altKeycode, "").replace(" ", "space")

	return { key: input, modifiers }
}

export function registerKeybinds(toRegister: readonly GeneralCommand[]) {
	toRegister.forEach(({ keybindings, label, callback, id }) =>
		keybindings.forEach((sequence) =>
			keybindsState.addSequence(sequence, { callback, id, label })
		)
	)
}
export function unregisterKeybinds(toUnregister: readonly GeneralCommand[]) {
	toUnregister.forEach(({ keybindings, label, callback, id }) =>
		keybindings.forEach((sequence) =>
			keybindsState.removeSequence(sequence, { callback, id, label })
		)
	)
}
