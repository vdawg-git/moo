import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { watch } from "chokidar"
import { distinctUntilChanged, Observable, share } from "rxjs"
import { Result } from "typescript-result"
import { DATA_DIRECTORY, playlistsDirectory } from "./constants"
import { examplePlaylist } from "./smartPlaylists/examplePlaylist"
import type { Stats } from "node:fs"
import type { ChokidarOptions } from "chokidar"
import type { EventName } from "chokidar/handler.js"
import type { AsyncResult } from "typescript-result"
import type { FilePath } from "./types/types"

// -- FileSystem abstraction --

export type FileStat = Readonly<{ mtime: Date; size: number }>

export type WatchOptions = Readonly<{
	ignored?: (path: string) => boolean
	depth?: number
}>

export type WatcherData = Readonly<{
	event: EventName
	filePath: FilePath
	stats: Stats | undefined
}>

/** Minimal filesystem interface for testability */
export type AppFileSystem = Readonly<{
	readFile(path: FilePath): Promise<Uint8Array>
	readTextFile(path: FilePath): Promise<string>
	readdir(
		path: FilePath,
		options?: { recursive?: boolean }
	): Promise<readonly string[]>
	stat(path: FilePath): Promise<FileStat>
	writeFile(path: FilePath, data: Uint8Array | string): Promise<void>
	exists(path: FilePath): Promise<boolean>
	watch(path: string, options?: WatchOptions): Observable<WatcherData>
}>

/** Production FileSystem backed by node:fs + chokidar */
export function createRealFileSystem(): AppFileSystem {
	return {
		async readFile(filePath) {
			const buffer = await Bun.file(filePath).arrayBuffer()

			return new Uint8Array(buffer)
		},

		readTextFile(filePath) {
			return readFile(filePath, "utf-8")
		},

		readdir(dirPath, options) {
			return readdir(dirPath, options)
		},

		async stat(filePath) {
			const stats = await stat(filePath)

			return { mtime: stats.mtime, size: stats.size }
		},

		async writeFile(filePath, data) {
			await writeFile(filePath, data)
		},

		async exists(filePath) {
			return Bun.file(filePath)
				.exists()
				.catch(() => false)
		},

		watch(watchPath, options) {
			return createWatcher(watchPath, {
				ignored: options?.ignored,
				depth: options?.depth
			})
		}
	}
}

// -- Watcher (kept exported for theme.ts and other direct consumers) --

const defaultWatchOptions: ChokidarOptions = {
	awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
	ignoreInitial: true
}

/**
 * Creates a directory/file watcher and emits changed files.
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

// -- Directory utilities --

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
