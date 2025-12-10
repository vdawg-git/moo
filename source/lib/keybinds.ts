import { pipe } from "remeda"
import { Result } from "typescript-result"
import { z } from "zod"
import { stripIndent } from "#/helpers"

/**
 * A single key input with its modifiers.
 * Should be used as an array as keybindings are sequenced.
 */
export type KeyInput = { key: string; modifiers: KeyModifier[] }

/** A keybinding is an array of {@linkcode KeyInput} */
export type KeyBinding = readonly KeyInput[]
/**
 * Shift wont get registered.
 * Instead only the uppercase letters get send from the terminal.
 */
const keyModifiers = ["ctrl", "alt", "shift"] as const
type KeyModifier = (typeof keyModifiers)[number]

const specialKeys = [
	"backspace",
	"delete",
	"esc",
	"insert",
	"return",
	"sigint",
	"tab",
	"up",
	"down",
	"right",
	"left",
	"f1",
	"f2",
	"f3",
	"f4",
	"f5",
	"f6",
	"f7",
	"f8",
	"f9",
	"f10",
	"f11",
	"f12",
	"space"
] as const

const tooManyPlusRg = /\+{3,}/

/**
 * The keybinding as written by the user in the keybindings config.
 * Not the whole command object.
 */
export const shortcutSchema = z
	.string()
	.min(1)
	.transform<KeyBinding>((toParse, ctx) =>
		parseKeybind(toParse).fold(
			(value) => value,
			(error) => {
				ctx.addIssue({
					message: error,
					code: "custom",
					fatal: true
				})
				return z.NEVER
			}
		)
	)
	.describe(
		'A keybinding. You can add modifiers like this `<modifier>+key`. You can also sequence keys by seperating them with a space like this "a b c"'
	)

function parseKeybind(raw: string): Result<KeyBinding, string> {
	return pipe(
		raw.trim(), //
		removeDuplicateWhitespace,
		(input) =>
			input
				.split(" ")
				.filter((string) => string !== "")
				.map(parseSequencePart),
		(results) => {
			return Result.all(...results) as Result<KeyBinding, string>
		}
	)
}

/**
 * This parses a sequence part of a keybinding.
 *
 * (most keybindings will consist of only one part so they are not actually a sequence),
 */
function parseSequencePart(input: string): Result<KeyInput, string> {
	if (tooManyPlusRg.test(input)) {
		return Result.error("Invalid amount of pluses")
	}

	// The parts of the keybinding, with leading modifiers if there are some
	const parts = splitOnPlus(input)
	const { key, modifiers = [] } =
		parts.length > 1
			? { modifiers: parts.slice(0, -1), key: parts.at(-1) }
			: { key: parts[0] }

	if (!key) {
		return Result.error(`Failed to parse keybind part: ${input} `)
	}

	const isKeyTooLong =
		key.length > 1 && !specialKeys.includes(key as (typeof specialKeys)[number])
	if (isKeyTooLong) {
		return Result.error(
			stripIndent(`Keycode "${input}" is too long. 
				If you want to sequence keys together add a space between them.
				If you tried to use a special key, here is a list of allowed special keys:
				${specialKeys.map((k) => `"${k}"`).join(", ")}`)
		)
	}

	const isModifierInvalid = modifiers.some(
		(modifier) => !keyModifiers.includes(modifier as KeyModifier)
	)
	if (isModifierInvalid) {
		return Result.error(
			stripIndent(`Invalid modifier. Allowed ones are: 
					${keyModifiers.map((k) => `"${k}"`).join(", ")}.`)
		)
	}

	return Result.ok({ key, modifiers: modifiers as KeyModifier[] })
}

/**
 * @example
 * removeDuplicateWhitespace("     ") //=> " "
 * */
function removeDuplicateWhitespace(text: string): string {
	return text.replaceAll(/ +/g, " ")
}

/**
 * Splits on +, but not if its the first or the last character
 * or preceeded by another + .
 * */
function splitOnPlus(text: string): string[] {
	return text.split(/(?<=.+)(?<!\+)\+(?!$)/g)
}

/**
 * Turns a keybinding object into its string representation.
 *
 * Can then be parsed by {@link shortcutSchema}.
 */
export function displayKeybinding(keySequence: KeyBinding): string {
	return keySequence
		.map(({ key, modifiers }) =>
			modifiers.length > 0 ? `${modifiers.join("+")}+${key}` : key
		)
		.join(" ")
}

// We always allow for multiple keybinds to exists for different actions,
// so it makes more sense to always return an array here
/**
 * A helper to create keybind defintions.
 *
 * If a string is given it creates a single keybind.
 * If an array of strings is given it creates one sequenced keybind.
 *
 * See {@link shortcutSchema } for the syntax
 * ! This is unsafe and should not be used for user code
 */
export function keybinding(
	input: string | readonly string[]
): readonly KeyBinding[] {
	// This freezes when the input is `escape`, idk why
	return Array.isArray(input)
		? input.map(parseKeybind).map((result) => result.getOrThrow())
		: [parseKeybind(input).getOrThrow()]
}
