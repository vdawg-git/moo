import { patchLogs } from "./logs"
import { render, useApp, useInput } from "ink"
import { FullScreen } from "./components/fullscreen"
import { Navigator } from "./components/navigator"
import { ErrorBoundary } from "react-error-boundary"
import { ErrorScreen } from "./components/errorScreen"
import { watchAndUpdateDatabase } from "./localFiles/localFiles"
import { config } from "./config/config"
import { database } from "./database/database"

const App = () => {
	const { exit } = useApp()
	useInput((input, key) => {
		if (key.ctrl && input.toLowerCase() === "c") {
			exit()
		}
	})

	return (
		<ErrorBoundary
			fallbackRender={({ error }) => <ErrorScreen error={error} />}
			onError={console.error}
		>
			<FullScreen flexDirection="column">
				<Navigator />

				{/* {IS_DEV && <LogView />} */}
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

	patchLogs()

	if (config.watchDirectories) {
		watchAndUpdateDatabase(config.musicDirectories, database)
	}

	// toggle fullscreen / different buffer
	await writeToStdout("\x1b[?1049h")

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
