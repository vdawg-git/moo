import { Playlist } from "./components/playlist"
import { connectDatabase } from "./database/database"
import { LogView } from "./components/logger"
import { patchLogs } from "./logs"
import { Box, render } from "ink"
import { FullScreen } from "./components/fullscreen"
import { IS_DEV } from "./constants"

const database = await connectDatabase()
// lets figure out a nice way of structuring the code
// if this throws, it throws for now.
// Lets also figure out a way to handle notifications nicely
await updateDatabase(database)
const tracks = await database.getTracks()

const App = () => {
	return (
		<FullScreen flexDirection="column">
			<Box flexGrow={100}>
				<Playlist tracks={tracks} onSelect={(id) => console.log(id)} />
			</Box>

			{IS_DEV && <LogView />}
		</FullScreen>
	)
}

export async function startApp() {
	// Optional, but should help to keep the app open
	process.stdin.resume()

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
