import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import {
	type Observable,
	debounceTime,
	filter,
	groupBy,
	map,
	mergeMap,
	share,
	switchMap,
	tap
} from "rxjs"
import { Result, type AsyncResult } from "typescript-result"
import * as yaml from "yaml"
import { playlistExtension, playlistsDirectory } from "#/constants"
import { createWatcher } from "#/filesystem"
import type { FilePath } from "#/types/types"
import { type PlaylistBlueprint, playlistBlueprintSchema } from "./schema"
import type { PlaylistId } from "#/database/types"
import { logg } from "#/logs"

/**
 * A time fast engough to feel instant,
 * but slow enough to catch for example mass search-and-replace of the playlists
 */
const playlistChangedDebounce = 70

type PlaylistParsed = {
	playlistPath: FilePath
	parseResult: Result<PlaylistBlueprint, Error>
}

// TODO handle playlist rename
export const playlistsChanged$: Observable<{
	playlistPath: FilePath
	event: "add" | "change" | "unlink"
}> = createWatcher(playlistsDirectory, {
	ignored: (path) =>
		!path.endsWith(playlistExtension) && path !== playlistsDirectory,
	depth: 1
}).pipe(
	filter(
		({ event }) => event === "add" || event === "change" || event === "unlink"
	),
	// We use groupBy to debounce individual filePaths,
	// as multiple files could be updated at once and debouncing them all at once
	// would lead to only the latest one being updated
	groupBy(({ filePath, event }) =>
		filePath + event === "unlink" ? "removed" : "updated"
	),
	mergeMap((changedFile$) =>
		changedFile$.pipe(
			debounceTime(playlistChangedDebounce),
			map(({ filePath, event }) => ({
				playlistPath: filePath,
				event: event as "add" | "change" | "unlink"
			}))
		)
	),
	share()
)

export async function parsePlaylistsAll(): Promise<
	Result<readonly PlaylistParsed[], Error>
> {
	return Result.fromAsyncCatching(readdir(playlistsDirectory))
		.map((paths) =>
			paths
				.filter(isSupportedExtension)
				.map(
					(relativePath) =>
						path.join(playlistsDirectory, relativePath) as FilePath
				)
				.map(
					async (filepath) =>
						({
							playlistPath: filepath,
							parseResult: await parsePlaylistBlueprintFromPath(filepath)
						}) satisfies PlaylistParsed
				)
		)
		.map((ok) => Promise.all(ok))
}

export function getPlaylistBlueprintFromId(
	id: PlaylistId
): AsyncResult<PlaylistBlueprint, Error> {
	return parsePlaylistBlueprintFromPath(playlistIdToFilePath(id))
}

function playlistIdToFilePath(id: PlaylistId): FilePath {
	return path.join(playlistsDirectory, id + playlistExtension) as FilePath
}

export function parsePlaylistBlueprintFromPath(
	filePath: FilePath
): AsyncResult<PlaylistBlueprint, Error> {
	return Result.fromAsyncCatching(readFile(filePath, "utf-8"))
		.map((text) => yaml.parse(text))
		.mapCatching((toParse) => playlistBlueprintSchema.parseAsync(toParse))
		.mapError((error) =>
			error instanceof Error
				? error
				: new Error(`Error parsing file: ${filePath}`, { cause: error })
		)
}

function isSupportedExtension(filepath: string): boolean {
	return path.extname(filepath) === playlistExtension
}
