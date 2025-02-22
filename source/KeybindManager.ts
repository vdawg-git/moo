import { useInput, useTextInput, type Key } from "tuir"
import { appConfig } from "./config/config"
import { useEffect, useState } from "react"
import { map, scan, Subject } from "rxjs"
import { isTruthy } from "remeda"
import type { KeyInput } from "./config/shortcutParser"
import type { AppCommand } from "./commands/commands"
import { match, P } from "ts-pattern"

/** This is a mirror of the internal `SpecialKeys`,
 * which does not get exported, but used in `useInput` */
type SpecialKeySet = Omit<Record<keyof typeof Key | "ctrl", boolean>, "sigint">
type InputData = { key: string; specialKeys: SpecialKeySet }

type CommandOrSequence =
	| { type: "command"; command: AppCommand }
	| { type: "sequence"; sequence: SequencePart }
export type SequencePart = {
	pressed: readonly KeyInput[]
	nextPossible: readonly AppCommand[]
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
	const [nextUpCommands, setNextUpCommands] = useState<
		SequencePart | undefined
	>(undefined)

	useInput((key, specialKeys) => inputs$.next({ key, specialKeys }))

	// we need a way to block regular UI inputs
	// while a sequence keybind is active (shown to the user)
	// --- or all elements are part of this keyboard system and register their keybinds dynamically .
	// For example a list registers its bindings (and they show up in the UI then too, and the global ones register theirs too)
	// This might be the best approach but requires us to overwrite and provide all keymaps and logic.
	// Which to some degree is nessecary anyways as the two-key vim keybinds wont work in list if the register buffer is set to `1`, which it is as otherwise the buffering behaviour is annoying.

	// Ideally some UI which shows the possible next combinations
	//
	useEffect(() => {
		const subscription = inputs$
			.pipe(
				map(tuirInputToKeyInput),
				scan(reduceInputs, undefined as CommandOrSequence | undefined)
			)
			.subscribe((inputResult) => {
				const nextUp =
					inputResult === undefined || inputResult.type === "command"
						? undefined
						: inputResult.sequence

				setNextUpCommands(nextUp)

				if (inputResult?.type === "command") {
					inputResult.command.callback()
				}
			})

		return () => subscription.unsubscribe()
	}, [inputs$])

	return nextUpCommands
}

function reduceInputs(
	previousCommandOrSequenceMaybe: CommandOrSequence | undefined,
	input: KeyInput
): CommandOrSequence | undefined {
	return match(previousCommandOrSequenceMaybe)
		.with(P.union(undefined, { type: "command" }), () => {
			const matchedCommand = getCommandFromSequence(
				[input],
				appConfig.keybindings
			)
			if (matchedCommand) {
				return { type: "command", command: matchedCommand } as const
			}

			const pressed = [input]
			const nextPossible = getNextPossibleSequences(
				pressed,
				appConfig.keybindings
			)

			return {
				type: "sequence" as const,
				sequence: {
					pressed,
					nextPossible
				} as const satisfies SequencePart
			}
		})
		.with(
			{ type: "sequence" },
			({
				sequence: { pressed: previousPressed, nextPossible: previousPossible }
			}) => {
				const pressed = [...previousPressed, input]
				const matchedCommand = getCommandFromSequence(pressed, previousPossible)
				if (matchedCommand)
					return {
						type: "command" as const,
						command: matchedCommand
					} as const

				const nextPossible = getNextPossibleSequences(pressed, previousPossible)

				return nextPossible.length > 0
					? {
							type: "sequence" as const,
							sequence: {
								nextPossible,
								pressed
							} as const
						}
					: undefined
			}
		)
		.exhaustive()
}

function getCommandFromSequence(
	input: readonly KeyInput[],
	commands: readonly AppCommand[]
): AppCommand | undefined {
	return commands.find(({ keybinding }) =>
		areKeyInputsMatching(input, keybinding)
	)
}

function areKeyInputsMatching(
	a: readonly KeyInput[],
	b: readonly KeyInput[]
): boolean {
	if (a.length !== b.length) return false

	return a.every((inputA, index) => {
		// biome-ignore lint/style/noNonNullAssertion: We know that the arrays have the same length
		const toCompare = b[index]!

		return (
			inputA.key === toCompare.key &&
			toCompare.modifiers.length === inputA.modifiers.length &&
			inputA.modifiers.every((aModifier) =>
				toCompare.modifiers.includes(aModifier)
			)
		)
	})
}

// Todo Optimize this as it checks all keys again,
// even though it should have checked the previous keys before.
// For example if "a b" matched, we dont need to check "a b" of "a b c" again.
function getNextPossibleSequences(
	input: readonly KeyInput[],
	commands: readonly AppCommand[]
): readonly AppCommand[] {
	return commands
		.filter(({ keybinding }) => keybinding.length >= input.length)
		.filter(({ keybinding }) =>
			areKeyInputsMatching(input, keybinding.slice(0, input.length))
		)
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
