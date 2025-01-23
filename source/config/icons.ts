import { z } from "zod"

export const iconsSchema = z
	.object({
		play: z
			.string()
			.default("")
			.describe("The play icon, also used as the playing indicator"),
		pause: z.string().default("").describe("The pause icon"),
		warn: z.string().default("").describe("Icon used for warnings"),
		next: z.string().default("󰼧").describe("Play next icon."),
		previous: z.string().default("󰼨").describe("Play previous icon."),
		playingIndicator: z
			.string()
			.default("")
			.describe("The indicator of a playing track in a list.")
	})
	.default({})
	.describe("Overwrite icons used in the app.")
