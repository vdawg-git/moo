import { mkdir, readdir } from "node:fs/promises"
import path from "node:path"
import { type ChokidarOptions, watch } from "chokidar"
import { distinctUntilChanged, Observable, share } from "rxjs"
import { Result, type AsyncResult } from "typescript-result"
import { DATA_DIRECTORY, playlistsDirectory } from "./constants"
import { examplePlaylist } from "./smartPlaylists/examplePlaylist"
import type { Stats } from "node:fs"
import type { EventName } from "chokidar/handler.js"
import type { FilePath } from "./types/types"

const defaultWatchOptions: ChokidarOptions = {
	awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
	ignoreInitial: true
}

type WatcherData = {
	event: EventName
	filePath: FilePath
	stats: Stats | undefined
}

/**
 * Creates a directory watcher and emits changed files.
 */
export function createWatcher(
	toWatch: string,
	options?: ChokidarOptions
): Observable<WatcherData> {
	return new Observable<WatcherData>((subscriber) => {
		const optionsMerged = { ...defaultWatchOptions, ...options }
		const watcher = watch(toWatch, optionsMerged).on(
			"all",
			(event, filePath, stats) =>
				subscriber.next({ event, filePath: filePath as FilePath, stats })
		)

		return () => watcher.close()
	}).pipe(
		distinctUntilChanged(
			(previous, current) =>
				JSON.stringify(previous) === JSON.stringify(current)
		),
		share()
	)
}

/**
 * Creates the directory if it does not exist.
 *
 * @return true if the directory existed, otherwise false
 * */
export function ensureDirectoryExists(
	directoryPath: FilePath
): AsyncResult<boolean, Error> {
	return Result.fromAsyncCatching(
		(async () => {
			const exists = await checkDirectoryExists(directoryPath)

			return exists
				? Result.ok(exists)
				: Result.fromAsyncCatching(
						mkdir(directoryPath, { recursive: true })
					).map(() => false)
		})()
	)
}

async function checkDirectoryExists(directoryPath: FilePath): Promise<boolean> {
	return readdir(directoryPath)
		.then(() => true)
		.catch(() => false)
}

/**
 * Creates the playlist directory if it does not exist
 * including an example playlist
 */
export async function setupFiles() {
	const _ = await ensureDirectoryExists(DATA_DIRECTORY).getOrThrow()

	const playlistsDirExists =
		await ensureDirectoryExists(playlistsDirectory).getOrThrow()

	if (!playlistsDirExists) {
		return Bun.write(
			path.join(playlistsDirectory, "example.yml"),
			examplePlaylist
		)
	}
}
