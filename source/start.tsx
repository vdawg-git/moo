import { createRoot } from "@opentui/react"
import { Result } from "typescript-result"
import { App } from "./App"
import { AppContextProvider, createAppContext } from "./appContext"
import { registerGlobalCommands } from "./commands/commandFunctions"
import { createCommandCallbacks } from "./commands/commandsCallbacks"
import { getConfig } from "./config/config"
import { databasePath, IS_DEV } from "./constants"
import { createDatabase } from "./database/database"
import { setupFiles } from "./filesystem"
import { keybindsState } from "./keybindManager/keybindsState"
import { keys$ } from "./keybindManager/keysStream"
import { updateDatabase, watchAndUpdateDatabase } from "./localFiles/localFiles"
import { logger } from "./logs"
import { createLocalPlayer } from "./player/player"
import { renderer } from "./renderer"
import {
	updateSmartPlaylists,
	watchPlaylists
} from "./smartPlaylists/smartPlaylist"

export async function startApp() {
	await setupFiles()

	process.on("uncaughtException", (error) => {
		logger.error("uncaughtException", {
			message: error.message,
			stack: error.stack
		})
		console.error(error.stack ?? error.message)
	})

	logger.info("Starting app..", { isDev: IS_DEV, dbPath: databasePath })

	const appConfig = await getConfig()

	const database = await createDatabase({
		databasePath,
		tagSeparator: appConfig.quickEdit.tagSeperator
	})
	const player = createLocalPlayer()

	const appContext = createAppContext({
		config: appConfig,
		database,
		player,
		keybindManagerDeps: { keybindsState, keys$ }
	})

	const addErrorNotification = appContext.notifications.addError
	const tagSeparator = appConfig.quickEdit.tagSeperator

	const destroyWatcher = appConfig.watchDirectories
		? watchAndUpdateDatabase({
				musicDirectories: appConfig.musicDirectories,
				database,
				addErrorNotification,
				tagSeparator
			})
		: undefined

	await Result.fromAsync(
		updateDatabase({
			musicDirectories: appConfig.musicDirectories,
			database,
			addErrorNotification,
			tagSeparator
		})
	)
		.map(() => updateSmartPlaylists({ database, addErrorNotification }))
		.onFailure((error) => {
			logger.error("Failed to update db at startup", { error })
			throw new Error("Failed to update database")
		})

	const playlistSubscription = watchPlaylists({
		database,
		addErrorNotification
	})

	const { getCommandCallback } = createCommandCallbacks({
		appState: appContext.appState,
		currentTrack$: appContext.derived.currentTrack$
	})

	const destroyGlobalCommands = registerGlobalCommands({
		registerKeybinds: appContext.keybindManager.registerKeybinds,
		getCommandCallback,
		keybindings: appConfig.keybindings
	})

	createRoot(renderer).render(
		<AppContextProvider value={appContext}>
			<App />
		</AppContextProvider>
	)

	return function destroy() {
		destroyWatcher?.()
		playlistSubscription.unsubscribe()
		destroyGlobalCommands()
	}
}
