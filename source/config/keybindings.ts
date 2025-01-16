import { z } from "zod"

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
	"f12"
] as const

const specialKey = z.enum(specialKeys)
const regularKey = z
	.string()
	.toLowerCase()
	.min(1, "Empty keybindings do not work.")
	.max(
		1,
		`A keybinding can only have one letter. Or be one of the special keys: ${specialKeys.map((key) => `\`${key}\``).join(",")}`
	)

const key = z.union([specialKey, regularKey])

export const keybindings = z
	.object({
		playPrevious: key
			.default("h")
			.describe("Global keybinding. Plays the previous track in the queue."),

		playNext: key
			.default("l")
			.describe("Global keybinding. Plays the next track in the queue."),

		togglePlayback: key
			.default(" ")
			.describe(
				"Global keybinding. Toggles the playback from pause to play and vice versa."
			)
	})
	.default({})
	.describe(
		"Override default keybindings. Setting this will not override all, but only those specified."
	)

/* const modifier = [
	"shift",
	"left_shift",
	"right_shift",
	"control",
	"left_control",
	"right_control"
] */
