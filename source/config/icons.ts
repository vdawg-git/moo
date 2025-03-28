import { shuffle } from "remeda"
import { z } from "zod"

export const iconsSchema = z
	.object({
		play: z
			.string()
			.default("")
			.describe("The play icon, also used as the playing indicator"),

		pause: z.string().default("").describe("The pause icon"),
		next: z.string().default(">").describe("Play next icon."),
		previous: z.string().default("<").describe("Play previous icon."),

		playingIndicator: z
			.string()
			.default("")
			.describe("The indicator of a playing track in a list."),

		error: z.string().default("").describe("Icon used for errors."),
		warn: z.string().default("").describe("Icon used for warnings."),
		info: z.string().default("").describe("Icon used for info boxes."),
		success: z
			.string()
			.default("")
			.describe("Icon used for success messages."),

		playlist: z
			.string()
			.default("")
			.describe("Icon used to indicate a playlist."),
		command: z
			.string()
			.default("❯")
			.describe("Icon used to indicate a command."),
		shuffle: z.string().default("󰒝").describe("Icon used for shuffling."),
		linear: z.string().default("󰒞").describe("Icon used for linear playback.")
	})
	.default({})
	.describe("Change the icons used in the app.")
