import path from "node:path"
import { createRoot } from "@opentui/react"
import { Result } from "typescript-result"
import { createRealFileSystem } from "#/adapters/filesystem/filesystem"
import { createLocalPlayer } from "#/adapters/mpv/player"
import { createDatabase } from "#/adapters/sqlite/database"
import { createCommandCallbacks } from "#/application/commands/callbacks"
import { registerGlobalCommands } from "#/application/commands/commandFunctions"
import { KeybindTrie } from "#/application/keybinds/keybindsState"
import { keys$ } from "#/application/keybinds/keysStream"
import { examplePlaylist } from "#/application/playlists/examplePlaylist"
import { createBlueprintResolver } from "#/application/playlists/playlistManager"
import { getConfig } from "#/shared/config/config"
import {
	DATA_DIRECTORY,
	databasePath,
	IS_DEV,
	playlistsDirectory
} from "#/shared/constants"
import { ensureDirectoryExists } from "#/shared/helpers"
import { logger } from "#/shared/logs"
import { App } from "./App"
import { AppContextProvider, createAppContext } from "./context"
import { renderer } from "./renderer"

export async function startApp() {
	// refactor those should take in a filesystem dep so that they become testable
	const _ = await ensureDirectoryExists(DATA_DIRECTORY).getOrThrow()
	const playlistsDirExists =
		await ensureDirectoryExists(playlistsDirectory).getOrThrow()
	if (!playlistsDirExists) {
		await Bun.write(
			path.join(playlistsDirectory, "example.yml"),
			examplePlaylist
		)
	}

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
		keybindManagerDeps: { keybindsState: new KeybindTrie(), keys$ },
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
		player
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
