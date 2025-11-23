import { createRoot } from "@opentui/react"
import { Result } from "typescript-result"
import { App } from "./App"
import { registerGlobalCommands } from "./commands/commandFunctions"
import { appConfig } from "./config/config"
import { databasePath, IS_DEV } from "./constants"
import { database } from "./database/database"
import { updateDatabase, watchAndUpdateDatabase } from "./localFiles/localFiles"
import { logg } from "./logs"
import { renderer } from "./renderer"
import {
	updateSmartPlaylists,
	watchPlaylists
} from "./smartPlaylists/smartPlaylist"

export async function startApp() {
	logg.info("Starting app..", { isDev: IS_DEV, dbPath: databasePath })

	if (appConfig.watchDirectories) {
		watchAndUpdateDatabase(appConfig.musicDirectories, database)
	}

	Result.fromAsync(updateDatabase(appConfig.musicDirectories, database))
		.map(() => updateSmartPlaylists())
		.onFailure((error) => {
			logg.error("Failed to update db at startup", { error })
			throw new Error("Failed to update database")
		})

	const watcher = watchPlaylists()

	createRoot(renderer).render(<App />)
	registerGlobalCommands()
	watcher.unsubscribe()
}
