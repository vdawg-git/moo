import { watch } from "node:fs"
import { mkdir, readdir } from "node:fs/promises"
import path from "node:path"
import { Observable, distinctUntilChanged, share } from "rxjs"
import { Result } from "typescript-result"
import { playlistsDirectory } from "./constants"
import { examplePlaylist } from "./smartPlaylists/examplePlaylist"
import type { FilePath } from "./types/types"

/**
 * Creates a directory watcher and emits changed files.
 */
export function createWatcher(
	toWatch: string,
	options: { recursive?: boolean } = {}
): Observable<FileChanged> {
	return new Observable<FileChanged>((subscriber) => {
		const watcher = watch(
			toWatch,
			{ recursive: options.recursive ?? true },
			(type, filePath) => {
				if (!filePath) return

				subscriber.next({
					type,
					filePath: path.join(toWatch, filePath) as FilePath
				})
			}
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
export async function ensureDirectoryExists(
	directoryPath: FilePath
): Promise<Result<boolean, Error>> {
	const exists = await checkDirectoryExists(directoryPath)

	return exists
		? Result.ok(exists)
		: Result.fromAsyncCatching(mkdir(directoryPath, { recursive: true })).map(
				() => false
			)
}

async function checkDirectoryExists(directoryPath: FilePath): Promise<boolean> {
	return readdir(directoryPath)
		.then(() => true)
		.catch(() => false)
}

type FileChanged = {
	/** The absolute filepath which changed */
	filePath: FilePath
	type: "change" | "rename"
}

export async function setupConfigDirectories() {
	const exists = (await ensureDirectoryExists(playlistsDirectory)).getOrThrow()

	if (!exists) {
		return Bun.write(
			path.join(playlistsDirectory, "example.yml"),
			examplePlaylist
		)
	}
}
