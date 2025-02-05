import path from "node:path"
import envPaths from "env-paths"
import packageJson from "#/../package.json"

export const IS_DEV = process.env.NODE_ENV !== "production"

export const APP_NAME = packageJson.name

const appPaths = envPaths(APP_NAME, { suffix: "" })
export const CONFIG_DIRECTORY = appPaths.config
export const DATA_DIRECTORY = appPaths.data
export const LOGS_DIRECTORY = appPaths.log
export const TEMP_DIRECTORY = appPaths.temp

// Drizzle Kit, which uses the databasePath, runs in CommonJs, so import.meta is not available
export const APP_ROOT = import.meta?.dirname
	? path.join(import.meta.dirname, "../")
	: path.join(__dirname, "../")

export const databasePath = IS_DEV
	? path.join(APP_ROOT, "db.db")
	: path.join(DATA_DIRECTORY, "database.db")
