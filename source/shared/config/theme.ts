import z from "zod"
import type { RGBA } from "@opentui/core"

export type AppColor = RGBA
export type AppColors = Readonly<{ [Key in keyof AppColorsBase]: RGBA }>
export type AppColorName = keyof AppColors

type AppColorsBase = ConfigTheme["ui"] & TerminalPalette

export const colors = {
	black: "black",
	red: "red",
	green: "green",
	yellow: "yellow",
	blue: "blue",
	magenta: "magenta",
	cyan: "cyan",
	white: "white",
	brightBlack: "grey",
	brightRed: "red",
	brightGreen: "green",
	brightYellow: "yellow",
	brightBlue: "blue",
	brightMagenta: "magenta",
	brightCyan: "cyan",
	brightWhite: "white",
	fg: "white",
	bg: "black"
}
export type TerminalPalette = typeof colors

const schemaUrl =
	"https://raw.githubusercontent.com/vdawg-git/moo/refs/heads/master/other/schemas/theme.json"

export const appThemeSchema = z
	.object({
		$schema: z.string().optional().default(schemaUrl),

		variables: z
			.record(z.string(), z.string())
			.default({})
			.describe(
				"Your color variables. You can reference those in the other sections of the theme."
			),

		palette: z
			.object({
				black: z.string().optional(),
				red: z.string().optional(),
				green: z.string().optional(),
				yellow: z.string().optional(),
				blue: z.string().optional(),
				magenta: z.string().optional(),
				cyan: z.string().optional(),
				white: z.string().optional(),
				brightBlack: z.string().optional(),
				brightRed: z.string().optional(),
				brightGreen: z.string().optional(),
				brightYellow: z.string().optional(),
				brightBlue: z.string().optional(),
				brightMagenta: z.string().optional(),
				brightCyan: z.string().optional(),
				brightWhite: z.string().optional(),
				fg: z
					.string()
					.optional()
					.describe("Default foreground color. Usually text and borders."),
				bg: z
					.string()
					.optional()
					.describe("Default background color for most things.")
			} satisfies Record<keyof TerminalPalette, unknown>)
			.optional(),

		ui: z
			.object({
				artists: z
					.string()
					.default(colors.yellow)
					.describe("The color to signify that this is an artist"),
				albums: z
					.string()
					.default(colors.cyan)
					.describe("The color to signify that this is an album"),
				playlists: z
					.string()
					.default(colors.magenta)
					.describe("The color to signify that this is a playlist"),
				commands: z
					.string()
					.default(colors.green)
					.describe("The color to signify that this is a command")
			})
			.default({
				artists: colors.yellow as string,
				albums: colors.cyan as string,
				playlists: colors.magenta as string,
				commands: colors.green as string
			})
			.describe(
				"Set the colors for different parts of the app. You can reference colors defined in `palette` here by name."
			)
	})
	.strict()
	.readonly()
export type ConfigTheme = z.output<typeof appThemeSchema>
