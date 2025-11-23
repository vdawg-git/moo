import path from "node:path"
import envPaths from "env-paths"
import { mapValues } from "remeda"
import packageJson from "#/../package.json"
import type { FilePath } from "./types/types"

// drizzle kit runs on Cjs where import.meta.dirname
// is not available
const isCompiled = import.meta?.dirname
	? import.meta.dirname.includes("$bunfs")
	: false

const nodeEnv = process.env.NODE_ENV

const thisDirectoryPath = import.meta.dirname ?? __dirname

// Compiled binaries have NODE_ENV="development" by default in Bun..
// React Devtools needs DEV set to be true to work
export const IS_DEV =
	!isCompiled && nodeEnv !== "production" && process.env.DEV === "true"

export const APP_NAME = IS_DEV ? packageJson.name + "_dev" : packageJson.name

// Drizzle Kit, which uses the databasePath, runs in CommonJs, so import.meta is not available
// Also import.meta.dirname will be "/$bunfs/root" when the app is compiled
export const APP_ROOT = isCompiled
	? path.dirname(process.execPath)
	: path.join(thisDirectoryPath, "..")

const appPaths = envPaths(APP_NAME, { suffix: "" })

export const CONFIG_DIRECTORY = appPaths.config as FilePath
export const DATA_DIRECTORY = appPaths.data as FilePath
export const LOGS_DIRECTORY = (
	isCompiled || !IS_DEV ? appPaths.log : path.dirname(APP_ROOT)
) as FilePath
export const TEMP_DIRECTORY = appPaths.temp as FilePath
export const playlistsDirectory = path.join(
	CONFIG_DIRECTORY,
	"playlists"
) as FilePath

export const databasePath = (
	IS_DEV && !isCompiled
		? path.join(APP_ROOT, "db.db")
		: path.join(DATA_DIRECTORY, "database.db")
) as FilePath

export const playlistExtension = ".yml"

// Calling the renderer is a huge side-effect which causes weird behaviour outside of the rendering.
// Like crashes. So for now lets just use default colors
// This needs to be reactive anyway once we have reactive themes.
//
// const {
// 	palette: [
// 		black,
// 		red,
// 		green,
// 		yellow,
// 		blue,
// 		magenta,
// 		cyan,
// 		white,
// 		brightBlack,
// 		brightRed,
// 		brightGreen,
// 		brightYellow,
// 		brightBlue,
// 		brightMagenta,
// 		brightCyan,
// 		brightWhite
// 	],
// 	defaultForeground: fg,
// 	defaultBackground: bg
// } = await renderer.getPalette()

export const colors = mapValues(
	{
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
	} as const,
	(value, key) => (value ?? key) as AppColor
)

export type AppColor = string
// export type AppColor = Tagged<string, "app_color">
