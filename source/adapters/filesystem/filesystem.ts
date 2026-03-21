import { readdir, readFile, stat, writeFile } from "node:fs/promises"
import { watch } from "chokidar"
import { distinctUntilChanged, Observable, share } from "rxjs"
import type { ChokidarOptions } from "chokidar"
import type { FilePath } from "#/shared/types/types"
import type { AppFileSystem, WatcherData } from "#/ports/filesystem"

export type { AppFileSystem, FileStat, WatcherData, WatchOptions } from "#/ports/filesystem"

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

