import { enumarateError, logg } from "./logs"
import {
	preserveScreen,
	render,
	setMouseReporting,
	Text,
	useInput,
	Viewport
} from "tuir"
import { Navigator } from "./components/navigator"
import { ErrorBoundary } from "react-error-boundary"
import { ErrorScreen } from "./components/errorScreen"
import { updateDatabase, watchAndUpdateDatabase } from "./localFiles/localFiles"
import { appConfig } from "./config/config"
import { database } from "./database/database"
import { Result } from "typescript-result"
import { IS_DEV } from "./constants"
import { registerAudioPlayback } from "./audio/audio"
import { useEffect } from "react"
import { reactToState } from "./state/stateReact"
import { ModalManager } from "./components/modalManager"
import { appState } from "./state/state"

const App = () => {
	useEffect(() => {
		const unsubscribes = [registerAudioPlayback(), reactToState()]
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
	// lets figure out a nice way of structuring the code
	// if this throws, it throws for now.
	// Lets also figure out a way to handle notifications nicely
	if (!IS_DEV) {
		updateDatabase(appConfig.musicDirectories, database)
	}

	logg.info("Starting app..")

	if (appConfig.watchDirectories) {
		watchAndUpdateDatabase(appConfig.musicDirectories, database)
	}

	// toggle fullscreen / different buffer
	await writeToStdout("\x1b[?1049h")

	if (!IS_DEV) {
		Result.fromAsync(updateDatabase(appConfig.musicDirectories, database))
			.onFailure((error) => {
				logg.error("Failed to update db at startup", { error })
			})
			.onSuccess(() => {
				logg.debug("Updated db")
			})
	}

	preserveScreen()
	const instance = render(<App />, { patchConsole: false })
	await instance.waitUntilExit()

	// exit fullscreen / use default buffer
	await writeToStdout("\x1b[?1049l")
}

async function writeToStdout(content: string) {
	return new Promise<void>((resolve, reject) => {
		process.stdout.write(content, (error) => {
			if (error) reject(error)
			else resolve()
		})
	})
}
