import { readFile } from "node:fs/promises"
import path from "node:path"
import { parseColor } from "@opentui/core"
import { mapValues } from "remeda"
import {
	distinctUntilChanged,
	from,
	map,
	shareReplay,
	startWith,
	switchMap
} from "rxjs"
import { createWatcher } from "#/adapters/filesystem/filesystem"
import { appThemeSchema } from "#/shared/config/theme"
import { CONFIG_DIRECTORY } from "#/shared/constants"
import { stringifyCompare } from "#/shared/library/functions"
import type { TerminalColors } from "@opentui/core"
import type {
	AppColors,
	ConfigTheme,
	TerminalPalette
} from "#/shared/config/theme"
import type { identity, Observable } from "rxjs"

const themePath = path.join(CONFIG_DIRECTORY, "theme.json5")

export const themeStream$ = from(lazyRendererPalette()).pipe(
	switchMap((terminalPalette) =>
		createThemeConfigStream().pipe(
			map((theme) => getAppColors(theme, terminalPalette))
		)
	),
	distinctUntilChanged(stringifyCompare) as typeof identity,
	shareReplay(1)
)

async function lazyRendererPalette(): Promise<TerminalPalette> {
	return import("./renderer")
		.then(({ renderer }) => renderer.getPalette())
		.then(parsePalette)
}

function createThemeConfigStream(): Observable<ConfigTheme> {
	return createWatcher(themePath, { ignoreInitial: false }).pipe(
		switchMap(async ({ filePath }) =>
			readFile(filePath, "utf-8")
				.then((text) => appThemeSchema.parseAsync(JSON.parse(text)))
				.catch(() => appThemeSchema.parseAsync({}))
		),
		startWith(appThemeSchema.parse({})),
		shareReplay(1)
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
		parseColor(
			variables[value] ?? (palette as Record<string, string>)[value] ?? value
		)
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
