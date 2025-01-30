import { distinctUntilChanged, Observable, share } from "rxjs"
import { watch } from "node:fs"
import type { FilePath } from "./types/types"
import path from "node:path"

/**
 * Creates a directory watcher and emits changed files.
 */
export function createWatcher(toWatch: string): Observable<FileChanged> {
	return new Observable<FileChanged>((subscriber) => {
		const watcher = watch(toWatch, { recursive: true }, (type, filePath) => {
			if (!filePath) return

			subscriber.next({
				type,
				filePath: path.join(toWatch, filePath) as FilePath
			})
		})

		return () => watcher.close()
	}).pipe(
		distinctUntilChanged(
			(previous, current) =>
				JSON.stringify(previous) === JSON.stringify(current)
		),
		share()
	)
}

type FileChanged = {
	/** The absolute filepath which changed */
	filePath: FilePath
	type: "change" | "rename"
}
