import { useEffect } from "react"
import { ErrorBoundary } from "react-error-boundary"
import {
	Viewport,
	preserveScreen,
	render,
	setCharRegisterSize,
	setMouseReporting
} from "tuir"
import { Result } from "typescript-result"
import { registerAudioPlayback } from "./playback/audio"
import { ErrorScreen } from "./components/errorScreen"
import { ModalManager } from "./components/modalManager"
import { Navigator } from "./components/navigator"
import { appConfig } from "./config/config"
import { databasePath, IS_DEV } from "./constants"
import { database } from "./database/database"
import { updateDatabase, watchAndUpdateDatabase } from "./localFiles/localFiles"
import { enumarateError, logg } from "./logs"
import {
	updateSmartPlaylists,
	watchPlaylists
} from "./smartPlaylists/smartPlaylist"
import { manageNotifications } from "./state/stateReact"
import { setupFiles } from "./filesystem"
import { NextUpKeybinds } from "./components/sequenceKeybindsShower"
import { registerGlobalCommands } from "./commands/commandFunctions"

const App = () => {
	setCharRegisterSize(1)
	useEffect(() => {
		const unsubscribes = [registerAudioPlayback(), manageNotifications()]
		setMouseReporting(true)

		return () => {
			setMouseReporting(false)
			unsubscribes.forEach((unsubscribe) => unsubscribe())
		}
	}, [])

	return (
		<ErrorBoundary
			fallbackRender={({ error }) => <ErrorScreen error={error} />}
			onError={(error) => {
				logg.error("react error", enumarateError(error))
			}}
		>
			<Viewport flexDirection="column">
				<Navigator />

				<ModalManager />
				<NextUpKeybinds />
			</Viewport>
		</ErrorBoundary>
	)
}

export async function startApp() {
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
}
