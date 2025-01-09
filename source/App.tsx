import { Tracklist } from "./components/tracklist"
import { LogView } from "./components/logger"
import { patchLogs } from "./logs"
import { Box, render } from "ink"
import { FullScreen } from "./components/fullscreen"
import { IS_DEV } from "./constants"
import { Navigator } from "./components/navigator"

const App = () => {
	return (
		<FullScreen flexDirection="column">
			<Navigator />

			{IS_DEV && <LogView />}
		</FullScreen>
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
