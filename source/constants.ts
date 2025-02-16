import packageJson from "#/../package.json"
import envPaths from "env-paths"
import path from "node:path"

// drizzle kit runs on Cjs where import.meta.dirname
// is not available
const isCompiled = import.meta?.dirname
	? import.meta.dirname.includes("$bunfs")
	: false

const nodeEnv = process.env.NODE_ENV

// Compiled binaries have NODE_ENV="development" by default in Bun..
export const IS_DEV = !isCompiled && nodeEnv !== "production"

export const APP_NAME = IS_DEV ? packageJson.name + "_dev" : packageJson.name

// Drizzle Kit, which uses the databasePath, runs in CommonJs, so import.meta is not available
// Also import.meta.dirname will be "/$bunfs/root" when the app is compiled
export const APP_ROOT = isCompiled
	? path.dirname(process.execPath)
	: path.join(import.meta.dirname, "..")

const appPaths = envPaths(APP_NAME, { suffix: "" })

export const CONFIG_DIRECTORY = appPaths.config
export const DATA_DIRECTORY = appPaths.data
export const LOGS_DIRECTORY =
	isCompiled || !IS_DEV ? appPaths.log : path.dirname(APP_ROOT)
export const TEMP_DIRECTORY = appPaths.temp

export const databasePath =
	IS_DEV && !isCompiled
		? path.join(APP_ROOT, "db.db")
		: path.join(DATA_DIRECTORY, "database.db")

// console.log({ appPaths, nodeEnv, isCompiled, dir: import.meta.dirname })
