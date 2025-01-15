import { z } from "zod"

export const icons = z
	.object({
		play: z.string().default("").describe("The play icon"),
		pause: z.string().default("").describe("The pause icon"),
		warn: z.string().default("").describe("Icon used for warnings"),
		next: z.string().default("󰼧").describe("Play next icon."),
		previous: z.string().default("󰼨").describe("Play previous icon.")
	})
	.default({})
	.describe("Overwrite icons used in the app.")
