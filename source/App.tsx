import { Playlist } from "./components/playlist"
import { connectDatabase } from "./database"
import { LogView } from "./components/logger"
import { patchLogs } from "./logs"
import { Box, render } from "ink"
import { FullScreen } from "./components/fullscreen"
import { IS_DEV } from "./constants"

const database = await connectDatabase()
const tracks = await database.getTracks()

const App = () => {
	return (
		<FullScreen flexDirection="column">
			<Box flexGrow={88}>
				<Playlist tracks={tracks} onChange={(id) => console.log(id)} />
			</Box>

			{IS_DEV && <LogView />}
		</FullScreen>
	)
}

export async function startApp() {
	patchLogs()

	// toggle fullscreen / different buffer
	await write("\x1b[?1049h")

	const instance = render(<App />, { patchConsole: false })
	await instance.waitUntilExit()

	// exit fullscreen / use default buffer
	await write("\x1b[?1049l")
}

async function write(content: string) {
	return new Promise<void>((resolve, reject) => {
		process.stdout.write(content, (error) => {
			if (error) reject(error)
			else resolve()
		})
	})
}
