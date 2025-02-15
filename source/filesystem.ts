import { watch } from "node:fs"
import { mkdir, readdir } from "node:fs/promises"
import path from "node:path"
import { Observable, distinctUntilChanged, share } from "rxjs"
import { Result } from "typescript-result"
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

export async function ensureDirectoryExists(
	directoryPath: FilePath
): Promise<Result<FilePath, Error>> {
	const exists = await checkDirectoryExists(directoryPath)

	return exists
		? Result.ok(directoryPath)
		: Result.fromAsyncCatching(mkdir(directoryPath)).map(() => directoryPath)
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
