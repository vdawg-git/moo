import { enumarateError, logg } from "./logs"
import { preserveScreen, render, setMouseReporting, Viewport } from "tuir"
import { Navigator } from "./components/navigator"
import { ErrorBoundary } from "react-error-boundary"
import { ErrorScreen } from "./components/errorScreen"
import { updateDatabase, watchAndUpdateDatabase } from "./localFiles/localFiles"
import { appConfig } from "./config/config"
import { database } from "./database/database"
import { Result } from "typescript-result"
import { IS_DEV } from "./constants"
import { manageKeybinds } from "./keybindingManagger"
import { registerAudioPlayback } from "./audio/audio"
import { useEffect } from "react"

const App = () => {
	manageKeybinds()

	useEffect(() => {
		const unsubscribe = registerAudioPlayback()
		setMouseReporting(true)

		return () => {
			setMouseReporting(false)
			unsubscribe()
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
			</Viewport>
		</ErrorBoundary>
	)
}

export async function startApp() {
	// Optional, but should help to keep the app open
	process.stdin.resume()

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
