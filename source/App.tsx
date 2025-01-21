import { logg } from "./logs"
import { render, setMouseReporting } from "tuir"
import { FullScreen } from "./components/fullscreen"
import { Navigator } from "./components/navigator"
import { ErrorBoundary } from "react-error-boundary"
import { ErrorScreen } from "./components/errorScreen"
import { updateDatabase, watchAndUpdateDatabase } from "./localFiles/localFiles"
import { appConfig } from "./config/config"
import { database } from "./database/database"
import { Result } from "typescript-result"
import { Playbar } from "./components/playbar"
import { IS_DEV } from "./constants"
import { useGlobalKeybindings } from "./globalKeybindings"
import { registerAudioPlayback } from "./audio/audio"
import { useEffect } from "react"
import { log } from "winston"

const App = () => {
	useGlobalKeybindings()
	// setMouseReporting(true)
	useEffect(() => {
		const subscribers = [registerAudioPlayback()]

		return () => {
			setMouseReporting(false)
			subscribers.forEach((subscriber) => subscriber.unsubscribe())
		}
	}, [])

	return (
		<ErrorBoundary
			fallbackRender={({ error }) => <ErrorScreen error={error} />}
			onError={logg.error}
		>
			<FullScreen flexDirection="column">
				<Navigator />
			</FullScreen>
		</ErrorBoundary>
	)
}

export async function startApp() {
	// Optional, but should help to keep the app open
	process.stdin.resume()

	// lets figure out a nice way of structuring the code
	// if this throws, it throws for now.
	// Lets also figure out a way to handle notifications nicely
	// updateDatabase(database).catch(console.error)

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
