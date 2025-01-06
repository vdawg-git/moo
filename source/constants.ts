import packageJson from "#/../package.json"
import envPaths from "env-paths"
import path from "node:path"

export const IS_DEV = process.env.NODE_ENV !== "production"

export const APP_NAME = packageJson.name

const appPaths = envPaths(APP_NAME)
export const CONFIG_DIRECTORY = appPaths.config
export const DATA_DIRECTORY = appPaths.data
export const LOGS_DIRECTORY = appPaths.log

export const databasePath = IS_DEV
	? path.join(process.cwd(), "db.db")
	: path.join(DATA_DIRECTORY, "database.db")
