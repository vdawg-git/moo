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
import { registerAudioPlayback } from "./audio/audio"
import { ErrorScreen } from "./components/errorScreen"
import { ModalManager } from "./components/modalManager"
import { Navigator } from "./components/navigator"
import { appConfig } from "./config/config"
import { IS_DEV } from "./constants"
import { database } from "./database/database"
import { updateDatabase, watchAndUpdateDatabase } from "./localFiles/localFiles"
import { enumarateError, logg } from "./logs"
import {
	updateSmartPlaylists,
	watchPlaylists
} from "./smartPlaylists/smartPlaylist"
import { manageNotifications } from "./state/stateReact"
import { setupConfigDirectories } from "./filesystem"

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
			</Viewport>
		</ErrorBoundary>
	)
}

export async function startApp() {
	await setupConfigDirectories()

	if (!IS_DEV) {
		updateDatabase(appConfig.musicDirectories, database)
	}

	logg.info("Starting app..")

	if (appConfig.watchDirectories) {
		watchAndUpdateDatabase(appConfig.musicDirectories, database)
	}

	if (!IS_DEV) {
		Result.fromAsync(updateDatabase(appConfig.musicDirectories, database))
			.onFailure((error) => {
				logg.error("Failed to update db at startup", { error })
			})
			.onSuccess(() => {
				logg.debug("Updated db")
			})
	}

	updateSmartPlaylists()
	const watcher = watchPlaylists()
	preserveScreen()
	const instance = render(<App />, { patchConsole: false })
	await instance.waitUntilExit()

	watcher.unsubscribe()
}

async function writeToStdout(content: string) {
	return new Promise<void>((resolve, reject) => {
		process.stdout.write(content, (error) => {
			if (error) reject(error)
			else resolve()
		})
	})
}
