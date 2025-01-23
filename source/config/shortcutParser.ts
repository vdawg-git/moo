import { z } from "zod"
import stripIndent from "strip-indent"
import { pipe } from "remeda"
import { Result } from "typescript-result"

/**
 * A single keybind chord.
 * Should be used as an array as keybindings are chorded.
 */
export type Keybinding = { key: string; modifiers: KeyModifier[] }
/**
 * Shift wont get registered.
 * Instead only the uppercase letters get send from the terminal.
 */
const keyModifiers = ["ctrl", "alt"] as const
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
	.transform<Keybinding[]>((toParse, ctx) => {
		const chords = pipe(toParse, removeDuplicateWhitespace, (rawKeybinding) =>
			rawKeybinding.split(" ").filter((string) => string !== "")
		)

		const parsed: Keybinding[] = []
		for (const chord of chords) {
			const result = parseChord(chord)
			if (result.isError()) {
				ctx.addIssue({
					message: result.error,
					code: z.ZodIssueCode.custom,
					fatal: true
				})
				return z.NEVER
			}
		}

		return parsed
	})
	.describe(
		'A keybinding. You can add modifiers like this `<modifier>+key`. You can also chord keys by seperating them with a space like this "a b c"'
	)

/**
 * This parses a chord of a keybinding (most keybindings will consist of only one chord),
 */
function parseChord(chord: string): Result<Keybinding, string> {
	if (tooManyPlusRg.test(chord)) {
		return Result.error("Invalid amount of pluses")
	}

	// The parts of the keybinding, with leading modifiers if there are some
	const parts = splitOnPlus(chord)
	const { key, modifiers } =
		parts.length > 1
			? { modifiers: parts.slice(0, -1), key: parts.at(-1) }
			: { key: parts[0] }

	if (!key) {
		return Result.error("Failed to parse keycode")
	}

	const isKeyTooLong =
		key.length > 1 || !specialKeys.includes(key as (typeof specialKeys)[number])
	if (isKeyTooLong) {
		return Result.error(
			stripIndent(`Keycode is too long. 
				If you want to chore keys together add a space between them.
				If you tried to use a special key, here is a list of allowed special keys:
				${specialKeys.map((k) => `"${k}"`).join(", ")}`)
		)
	}

	const isModifierInvalid = modifiers
		? modifiers.some(
				(modifier) => !keyModifiers.includes(modifier as KeyModifier)
			)
		: false
	if (isModifierInvalid) {
		return Result.error(
			`Invalid modifier. Allowed ones are ${keyModifiers.map((k) => `"${k}"`).join(", ")}.`
		)
	}

	return Result.ok({ key, modifiers: (modifiers ?? []) as KeyModifier[] })
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
export function displayKeybinding(chords: readonly Keybinding[]): string {
	return chords
		.map(({ key, modifiers }) =>
			modifiers.length > 0 ? `${modifiers.join("+")}+${key}` : key
		)
		.join(" ")
}

/* {
		message: stringIndent(`Invalid keybinding. 
			Supported keybindings look like "<modifier>+<key>, where the modifier is optional. 
			Keys can also be chored together.
			For example: "x", "x a" (a chord), "shift+x" and "ctrl+shift+x" (multiple modifiers) are all valid keybindings. `)
	} */
