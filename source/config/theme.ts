import { readFile } from "node:fs/promises"
import path from "node:path"
import { parseColor, type RGBA, type TerminalColors } from "@opentui/core"
import { mapValues } from "remeda"
import {
	distinctUntilChanged,
	from,
	type identity,
	map,
	type Observable,
	shareReplay,
	startWith,
	switchMap
} from "rxjs"
import z from "zod"
import { CONFIG_DIRECTORY } from "#/constants"
import { createWatcher } from "#/filesystem"
import { stringifyCompare } from "#/lib/functions"
import { logg } from "#/logs"

const themePath = path.join(CONFIG_DIRECTORY, "theme.json5")

export type AppColor = RGBA
export type AppColors = Readonly<{ [Key in keyof AppColorsBase]: RGBA }>
export type AppColorName = keyof AppColors

type AppColorsBase = ConfigTheme["ui"] & TerminalPalette

export const themeStream$ = from(lazyRendererPalette()).pipe(
	switchMap((terminalPalette) =>
		createThemeConfigStream().pipe(
			map((theme) => getAppColors(theme, terminalPalette))
		)
	),
	distinctUntilChanged(stringifyCompare) as typeof identity,
	shareReplay()
)

themeStream$.subscribe((t) => logg.debug("THEME HERE", { t }))

const colors = {
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
type TerminalPalette = typeof colors

const schemaUrl =
	"https://raw.githubusercontent.com/vdawg-git/moo/refs/heads/master/other/schemas/theme.json"

export const schemaTheme = z.object({
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
				.default(colors.blue)
				.describe("The color to signify that this is an artist"),
			albums: z
				.string()
				.default(colors.cyan)
				.describe("The color to signify that this is an album"),
			playlists: z
				.string()
				.default(colors.magenta)
				.describe("The color to signify that this is an playlist"),
			commands: z
				.string()
				.default(colors.yellow)
				.describe("The color to signify that this is a command")
		})
		.default({
			albums: colors.cyan as string,
			artists: colors.blue as string,
			commands: colors.yellow as string,
			playlists: colors.magenta as string
		})
		.describe(
			"Set the colors for different parts of the app. You can reference colors defined in `palette` here by name."
		)
})
type ConfigTheme = z.output<typeof schemaTheme>

async function lazyRendererPalette() {
	return import("#/renderer")
		.then(({ renderer }) => renderer.getPalette())
		.then(parsePalette)
}

function createThemeConfigStream(): Observable<ConfigTheme> {
	return createWatcher(themePath, { ignoreInitial: false }).pipe(
		switchMap(async ({ filePath }) =>
			readFile(filePath, "utf-8")
				.then((text) => schemaTheme.parseAsync(JSON.parse(text)))
				.catch(() => schemaTheme.parseAsync({}))
		),
		startWith(schemaTheme.parse({})),
		shareReplay()
	)
}

function getAppColors(
	theme: ConfigTheme,
	terminalPalette: TerminalPalette
): AppColors {
	const { variables, ui, palette: userPalette } = theme
	const palette = { ...terminalPalette, ...userPalette }
	const baseAppColors = { ...ui, ...palette }

	return mapValues(baseAppColors, (value) =>
		parseColor(variables[value] ?? value)
	)
}

function parsePalette(terminalColors: TerminalColors): TerminalPalette {
	const { palette, defaultForeground, defaultBackground } = terminalColors

	// OpenTui can parse CSS color names like 'black'
	return {
		black: palette[0] ?? "black",
		red: palette[1] ?? "red",
		green: palette[2] ?? "green",
		yellow: palette[3] ?? "yellow",
		blue: palette[4] ?? "blue",
		magenta: palette[5] ?? "magenta",
		cyan: palette[6] ?? "cyan",
		white: palette[7] ?? "white",
		brightBlack: palette[8] ?? "black",
		brightRed: palette[9] ?? "red",
		brightGreen: palette[10] ?? "green",
		brightYellow: palette[11] ?? "yellow",
		brightBlue: palette[12] ?? "blue",
		brightMagenta: palette[13] ?? "magenta",
		brightCyan: palette[14] ?? "cyan",
		brightWhite: palette[15] ?? "white",
		// dunno if those really can be undefined.
		fg: defaultForeground!,
		bg: defaultBackground!
	}
}
