import {
	debounceTime,
	filter,
	groupBy,
	map,
	mergeMap,
	type Observable,
	share,
	switchMap
} from "rxjs"
import * as yaml from "yaml"
import { playlistSchema, type PlaylistSchema } from "./schema"
import { createWatcher } from "#/filesystem"
import { CONFIG_DIRECTORY } from "#/constants"
import path from "node:path"
import { Result } from "typescript-result"
import { readdir, readFile } from "node:fs/promises"
import type { FilePath } from "#/types/types"
import type { PlaylistId } from "#/database/types"

const playlistsDirectory = path.join(CONFIG_DIRECTORY, "playlists")
const validExtensions = [".yml", ".yaml"]

/**
 * A time fast engough to feel instant,
 * but slow enough to catch for example mass fast-and-replace of the playlists
 */
const playlistChangedDebounce = 70

type PlaylistParsed = {
	playlistPath: PlaylistId
	parseResult: Result<PlaylistSchema, Error>
}

// TODO handle playlist rename
export const playlistsChanged$: Observable<PlaylistParsed> = createWatcher(
	playlistsDirectory
).pipe(
	filter(({ filePath }) => isSupportedExtension(filePath)),
	// We use groupBy to debounce individual filePaths,
	// as multiple files could be updates at once and debouncing them all at once
	// would lead to only the latest one updating
	groupBy(({ filePath }) => filePath),
	mergeMap((changedFile$) =>
		changedFile$.pipe(
			debounceTime(playlistChangedDebounce),
			switchMap(({ filePath }) =>
				parsePlaylist(filePath).then((parseResult) => ({
					parseResult,
					playlistPath: filePath as unknown as PlaylistId
				}))
			)
		)
	),
	share()
)

export async function parsePlaylists(): Promise<
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
							playlistPath: filepath as unknown as PlaylistId,
							parseResult: await parsePlaylist(filepath)
						}) satisfies PlaylistParsed
				)
		)
		.map((ok) => Promise.all(ok))
}

async function parsePlaylist(
	filePath: FilePath
): Promise<Result<PlaylistSchema, Error>> {
	return Result.fromAsyncCatching(readFile(filePath, "utf-8"))
		.map((text) => yaml.parse(text))
		.mapCatching((toParse) => playlistSchema.parseAsync(toParse))
		.mapError((error) =>
			error instanceof Error
				? error
				: new Error(`Error parsing file: ${filePath}`, { cause: error })
		)
}

function isSupportedExtension(filepath: string): boolean {
	return validExtensions.some((extension) => filepath.endsWith(extension))
}
