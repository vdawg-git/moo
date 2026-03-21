import { createRoot } from "@opentui/react"
import { Result } from "typescript-result"
import { App } from "./App"
import { AppContextProvider, createAppContext } from "./appContext"
import { registerGlobalCommands } from "./commands/commandFunctions"
import { createCommandCallbacks } from "./commands/commandsCallbacks"
import { getConfig } from "./config/config"
import { databasePath, IS_DEV, playlistsDirectory } from "./constants"
import { createDatabase } from "./database/database"
import { createRealFileSystem, setupFiles } from "./filesystem"
import { createBlueprintResolver } from "./smartPlaylists/playlistManager"
import { keybindsState } from "./keybindManager/keybindsState"
import { keys$ } from "./keybindManager/keysStream"
import { logger } from "./logs"
import { createLocalPlayer } from "./player/player"
import { renderer } from "./renderer"

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

	const fileSystem = createRealFileSystem()
	const database = await createDatabase({
		databasePath,
		tagSeparator: appConfig.quickEdit.tagSeperator,
		getBlueprint: createBlueprintResolver({ fileSystem, playlistsDirectory })
	})
	const player = createLocalPlayer()

	const appContext = createAppContext({
		config: appConfig,
		database,
		player,
		keybindManagerDeps: { keybindsState, keys$ },
		fileSystem
	})

	const destroyWatcher = appConfig.watchDirectories
		? appContext.musicLibrary.watch()
		: undefined

	await Result.fromAsync(appContext.musicLibrary.scan())
		.map(() => appContext.playlistManager.scanAll())
		.onFailure((error) => {
			logger.error("Failed to update db at startup", { error })
			throw new Error("Failed to update database")
		})

	const playlistSubscription = appContext.playlistManager.watch()

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
