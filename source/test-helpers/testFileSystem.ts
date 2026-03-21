import path from "node:path"
import { filter, Subject } from "rxjs"
import type { AppFileSystem, FileStat, WatcherData } from "#/adapters/filesystem/filesystem"
import type { FilePath } from "#/shared/types/types"
import type { Observable } from "rxjs"

type MemoryEntry = Readonly<{
	content: Uint8Array
	mtime: Date
	size: number
}>

export const testPlaylistsDirectory = "/playlists"

// keep exports above implementation
export type TestFileSystem = AppFileSystem
	& Readonly<{
		/** Add or update a file — automatically emits watch events */
		setFile(
			filePath: string,
			content: Uint8Array | string,
			options?: { mtime?: Date }
		): void
		/** Remove a file — automatically emits an unlink watch event */
		removeFile(filePath: string): void
		/** Add a music track file. If metadata is provided, it's JSON-encoded as file content for mock parsers. */
		addTrack(
			fileNameOrPath: string,
			options?: {
				directory?: string
				metadata?: Record<string, unknown>
				mtime?: Date
			}
		): void
		/** Add a YAML playlist file. Auto-appends `.yml` extension. */
		addPlaylist(
			name: string,
			yaml: string,
			options?: { directory?: string }
		): void
		/** Remove a track file. Mirrors `addTrack` path resolution. */
		removeTrack(
			fileNameOrPath: string,
			options?: { directory?: string }
		): void
		/** Remove a playlist file. Auto-appends `.yml` extension. Mirrors `addPlaylist` path resolution. */
		removePlaylist(name: string, options?: { directory?: string }): void
	}>

/** In-memory FileSystem for testing. setFile/removeFile emit watch events. */
export function createTestFileSystem(): TestFileSystem {
	const files = new Map<string, MemoryEntry>()
	const watchSubject = new Subject<WatcherData>()

	function toUint8Array(data: Uint8Array | string): Uint8Array {
		return typeof data === "string" ? new TextEncoder().encode(data) : data
	}

	function isSubpath(parentDirectory: string, childPath: string): boolean {
		const normalized = path.resolve(childPath)
		const normalizedParent = parentDirectory.endsWith("/")
			? path.resolve(parentDirectory)
			: path.resolve(parentDirectory) + "/"

		return normalized.startsWith(normalizedParent)
	}

	function setFile(
		filePath: string,
		content: Uint8Array | string,
		options?: { mtime?: Date }
	): void {
		const bytes = toUint8Array(content)
		const existed = files.has(filePath)
		files.set(filePath, {
			content: bytes,
			mtime: options?.mtime ?? new Date(),
			size: bytes.byteLength
		})

		watchSubject.next({
			event: existed ? "change" : "add",
			filePath: filePath as FilePath,
			stats: undefined
		})
	}

	const fileSystem: TestFileSystem = {
		async readFile(filePath) {
			const entry = files.get(filePath)
			if (!entry) {
				throw new Error(`ENOENT: no such file: ${filePath}`)
			}

			return entry.content
		},

		async readTextFile(filePath) {
			const entry = files.get(filePath)
			if (!entry) {
				throw new Error(`ENOENT: no such file: ${filePath}`)
			}

			return new TextDecoder().decode(entry.content)
		},

		async readdir(dirPath, options) {
			const normalizedDir = dirPath.endsWith("/") ? dirPath : dirPath + "/"
			const results: string[] = []

			for (const filePath of files.keys()) {
				if (!filePath.startsWith(normalizedDir)) continue

				const relative = filePath.slice(normalizedDir.length)
				if (!options?.recursive && relative.includes("/")) continue

				results.push(relative)
			}

			return results
		},

		async stat(filePath): Promise<FileStat> {
			const entry = files.get(filePath)
			if (!entry) {
				throw new Error(`ENOENT: no such file: ${filePath}`)
			}

			return { mtime: entry.mtime, size: entry.size }
		},

		async writeFile(filePath, data) {
			const bytes = toUint8Array(data)
			const existed = files.has(filePath)
			files.set(filePath, {
				content: bytes,
				mtime: new Date(),
				size: bytes.byteLength
			})

			watchSubject.next({
				event: existed ? "change" : "add",
				filePath: filePath,
				stats: undefined
			})
		},

		async exists(filePath) {
			return files.has(filePath)
		},

		watch(watchPath, options): Observable<WatcherData> {
			return watchSubject.pipe(
				filter(({ filePath }) => isSubpath(watchPath, filePath)),
				filter(({ filePath }) =>
					options?.ignored ? !options.ignored(filePath) : true
				)
			)
		},

		setFile,

		removeFile(filePath) {
			files.delete(filePath)
			watchSubject.next({
				event: "unlink",
				filePath: filePath as FilePath,
				stats: undefined
			})
		},

		addTrack(fileNameOrPath, options) {
			const filePath = fileNameOrPath.startsWith("/")
				? fileNameOrPath
				: `${options?.directory ?? "/music"}/${fileNameOrPath}`

			const content = options?.metadata
				? JSON.stringify(options.metadata)
				: new Uint8Array([1])

			setFile(filePath, content, { mtime: options?.mtime })
		},

		addPlaylist(name, yaml, options) {
			const directory = options?.directory ?? testPlaylistsDirectory
			setFile(`${directory}/${name}.yml`, yaml)
		},

		removeTrack(fileNameOrPath, options) {
			const filePath = fileNameOrPath.startsWith("/")
				? fileNameOrPath
				: `${options?.directory ?? "/music"}/${fileNameOrPath}`

			fileSystem.removeFile(filePath)
		},

		removePlaylist(name, options) {
			const directory = options?.directory ?? testPlaylistsDirectory
			fileSystem.removeFile(`${directory}/${name}.yml`)
		}
	}

	return fileSystem
}
