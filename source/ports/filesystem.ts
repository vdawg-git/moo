import type { Stats } from "node:fs"
import type { FilePath } from "#/shared/types/types"
import type { EventName } from "chokidar/handler.js"
import type { Observable } from "rxjs"

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
