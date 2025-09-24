import packageJson from "#/../package.json"
import envPaths from "env-paths"
import path from "node:path"
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
