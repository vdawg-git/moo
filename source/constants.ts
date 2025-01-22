import path from "node:path"
import envPaths from "env-paths"
import packageJson from "#/../package.json"
import { exists } from "node:fs/promises"

exists(path.join(process.cwd(), "package.json")).then((isExisting) => {
	if (!isExisting) {
		// we need this as Drizzle kit does not support esm yet,
		// so determining the correct path for the app root
		// is a pain, as we cant use import.meta, nor top level await.
		// Lets see if this approach is really a good idea
		//
		// Also Drizzle kit does not run in Bun,
		// so we cant use Bun Apis for things Kit needs.
		// Which luckily is only the database path
		throw new Error("Process working directory is not the app root.")
	}
})

export const IS_DEV = process.env.NODE_ENV !== "production"

export const APP_NAME = packageJson.name

const appPaths = envPaths(APP_NAME, { suffix: "" })
export const CONFIG_DIRECTORY = appPaths.config
export const DATA_DIRECTORY = appPaths.data
export const LOGS_DIRECTORY = appPaths.log
export const TEMP_DIRECTORY = appPaths.temp
export const APP_ROOT = process.cwd()

export const databasePath = IS_DEV
	? path.join(APP_ROOT, "db.db")
	: path.join(DATA_DIRECTORY, "database.db")
