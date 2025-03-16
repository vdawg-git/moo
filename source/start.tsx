import path from "node:path"
import { preserveScreen, render, setConsole } from "tuir"
import { Result } from "typescript-result"
import { App } from "./App"
import { registerGlobalCommands } from "./commands/commandFunctions"
import { appConfig } from "./config/config"
import { IS_DEV, LOGS_DIRECTORY, databasePath } from "./constants"
import { database } from "./database/database"
import { updateDatabase, watchAndUpdateDatabase } from "./localFiles/localFiles"
import { logg } from "./logs"
import {
	updateSmartPlaylists,
	watchPlaylists
} from "./smartPlaylists/smartPlaylist"

export async function startApp() {
	logg.info("Starting app..", { isDev: IS_DEV, dbPath: databasePath })

	const consoleLogsPath = path.join(LOGS_DIRECTORY, "console.log")
	setConsole({ enabled: true, path: consoleLogsPath })

	if (IS_DEV) {
		const { initialize, connectToDevTools } = await import(
			//@ts-ignore
			"react-devtools-core"
		)

		initialize()
		// Must be called before packages like react or react-native are imported
		connectToDevTools()
	}

	if (appConfig.watchDirectories) {
		watchAndUpdateDatabase(appConfig.musicDirectories, database)
	}

	Result.fromAsync(updateDatabase(appConfig.musicDirectories, database))
		.map(() => updateSmartPlaylists())
		.onFailure((error) => {
			logg.error("Failed to update db at startup", { error })
			throw new Error("Failed to update database")
		})
		.onSuccess(() => {
			logg.info("Updated db")
		})

	const watcher = watchPlaylists()
	preserveScreen()
	const instance = render(<App />, { patchConsole: false, throttle: 8 })
	registerGlobalCommands()
	await instance.waitUntilExit()

	watcher.unsubscribe()
	setConsole({ enabled: false, path: consoleLogsPath })
}
