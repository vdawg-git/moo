import path from "node:path"
import { useEffect } from "react"
import {
	Viewport,
	preserveScreen,
	render,
	setCharRegisterSize,
	setConsole,
	setMouseReporting
} from "tuir"
import { Result } from "typescript-result"
import { registerGlobalCommands } from "./commands/commandFunctions"
import { ModalManager } from "./components/modalManager"
import { Navigator } from "./components/navigator"
import { NextUpKeybinds } from "./components/sequenceKeybindsShower"
import { appConfig } from "./config/config"
import { IS_DEV, LOGS_DIRECTORY, databasePath } from "./constants"
import { database } from "./database/database"
import { setupFiles } from "./filesystem"
import { updateDatabase, watchAndUpdateDatabase } from "./localFiles/localFiles"
import { logg } from "./logs"
import { handleAudioPlayback } from "./playback/playback"
import {
	updateSmartPlaylists,
	watchPlaylists
} from "./smartPlaylists/smartPlaylist"
import { manageNotifications } from "./state/stateReact"

const App = () => {
	setCharRegisterSize(1)
	useEffect(() => {
		const unsubscribes = [handleAudioPlayback(), manageNotifications()]
		setMouseReporting(true)

		return () => {
			setMouseReporting(false)
			unsubscribes.forEach((unsubscribe) => unsubscribe())
		}
	}, [])

	return (
		<Viewport flexDirection="column">
			<Navigator />

			<ModalManager />
			<NextUpKeybinds />
		</Viewport>
	)
}

export async function startApp() {
	const consoleLogsPath = path.join(LOGS_DIRECTORY, "console.log")
	setConsole({ enabled: true, path: consoleLogsPath })

	await setupFiles()

	if (IS_DEV) {
		const { initialize, connectToDevTools } = await import(
			//@ts-ignore
			"react-devtools-core"
		)

		initialize()
		// Must be called before packages like react or react-native are imported
		connectToDevTools()
	}

	logg.info("Starting app..", { is_dev: IS_DEV, dbPath: databasePath })

	if (appConfig.watchDirectories) {
		watchAndUpdateDatabase(appConfig.musicDirectories, database)
	}

	Result.fromAsync(updateDatabase(appConfig.musicDirectories, database))
		.onFailure((error) => {
			logg.error("Failed to update db at startup", { error })
			throw new Error("Failed to update database")
		})
		.onSuccess(() => {
			logg.info("Updated db")
		})

	updateSmartPlaylists()
	const watcher = watchPlaylists()
	preserveScreen()
	const instance = render(<App />, { patchConsole: false, throttle: 8 })
	registerGlobalCommands()
	await instance.waitUntilExit()

	watcher.unsubscribe()
	setConsole({ enabled: false, path: consoleLogsPath })
}
