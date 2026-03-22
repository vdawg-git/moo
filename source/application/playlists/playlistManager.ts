import path, { basename, extname } from "node:path"
import { debounceTime, filter, groupBy, map, mergeMap, share } from "rxjs"
import { match, P } from "ts-pattern"
import { Result } from "typescript-result"
import * as yaml from "yaml"
import { fromError } from "zod-validation-error"
import { playlistBlueprintSchema } from "#/core/playlists/schema"
import { playlistExtension } from "#/shared/constants"
import { logger } from "#/shared/logs"
import type { AppFileSystem } from "#/adapters/filesystem/filesystem"
import type { PlaylistBlueprint } from "#/core/playlists/schema"
import type { AppDatabase, PlaylistId } from "#/ports/database"
import type { ErrorNotificationFn, FilePath } from "#/shared/types/types"
import type { Subscription } from "rxjs"
import type { AsyncResult } from "typescript-result"

export type PlaylistManager = Readonly<{
	/** Parse all playlists and sync DB */
	scanAll(): Promise<void>
	/** Watch playlist directory, auto-update DB. Returns subscription */
	watch(): Subscription
	/** Get a single playlist blueprint by ID */
	getBlueprint(id: PlaylistId): AsyncResult<PlaylistBlueprint, Error>
}>

export type PlaylistManagerDeps = Readonly<{
	fileSystem: AppFileSystem
	database: AppDatabase
	addErrorNotification: ErrorNotificationFn
	playlistsDirectory: FilePath
}>

export function createPlaylistManager(
	deps: PlaylistManagerDeps
): PlaylistManager {
	const { fileSystem, database, addErrorNotification, playlistsDirectory } =
		deps

	/**
	 * A time fast enough to feel instant,
	 * but slow enough to catch mass search-and-replace
	 */
	const playlistChangedDebounce = 70

	return {
		async scanAll() {
			return scanAllPlaylists({
				fileSystem,
				database,
				addErrorNotification,
				playlistsDirectory
			})
		},

		watch() {
			const playlistsChanged$ = fileSystem
				.watch(playlistsDirectory, {
					ignored: (watchPath) =>
						!watchPath.endsWith(playlistExtension)
						&& watchPath !== playlistsDirectory,
					depth: 1
				})
				.pipe(
					filter(
						({ event }) =>
							event === "add" || event === "change" || event === "unlink"
					),
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

			return playlistsChanged$.subscribe(async ({ playlistPath, event }) => {
				const playlistId = basename(
					playlistPath,
					extname(playlistPath)
				) as PlaylistId
				logger.debug("playlist changed", {
					playlistId,
					playlistPath,
					event
				})

				await match(event)
					.with(P.union("add", "change"), () =>
						parsePlaylistBlueprintFromPath(fileSystem, playlistPath as FilePath)
							.map((schema) =>
								database.upsertSmartPlaylist({
									id: playlistId,
									schema
								})
							)
							.onSuccess(() => {
								logger.debug("Updated smart-playlist", {
									playlistId,
									playlistPath
								})
							})
							.onFailure((error) =>
								addErrorNotification(
									`Failed to update playlist "${playlistId}"\n${error.message}`,
									{ error, playlistId },
									"Failed playlist update"
								)
							)
					)
					.with("unlink", () =>
						database
							.deletePlaylist(playlistId)
							.onSuccess(() => {
								logger.debug("Removed smart-playlist", {
									playlistId,
									playlistPath
								})
							})
							.onFailure((error) =>
								addErrorNotification(
									`Failed to remove playlist "${playlistId}"\n${error.message}`,
									{ error, playlistId },
									"Failed playlist removal"
								)
							)
					)
					.exhaustive()
			})
		},

		getBlueprint(id) {
			return parsePlaylistBlueprintFromPath(
				fileSystem,
				playlistIdToFilePath(playlistsDirectory, id)
			)
		}
	}
}

/** Creates a standalone blueprint resolver for use outside the playlist manager */
export function createBlueprintResolver(deps: {
	readonly fileSystem: AppFileSystem
	readonly playlistsDirectory: FilePath
}): (id: PlaylistId) => AsyncResult<PlaylistBlueprint, Error> {
	return (id) =>
		parsePlaylistBlueprintFromPath(
			deps.fileSystem,
			playlistIdToFilePath(deps.playlistsDirectory, id)
		)
}

function isSupportedExtension(filepath: string): boolean {
	return path.extname(filepath) === playlistExtension
}

function playlistPathToId(filepath: FilePath): PlaylistId {
	return path.basename(filepath, ".yml") as PlaylistId
}

function playlistIdToFilePath(
	playlistsDirectory: FilePath,
	id: PlaylistId
): FilePath {
	return path.join(playlistsDirectory, id + playlistExtension) as FilePath
}

function parsePlaylistBlueprintFromPath(
	fileSystem: AppFileSystem,
	filePath: FilePath
): AsyncResult<PlaylistBlueprint, Error> {
	return Result.fromAsyncCatching(
		fileSystem.readTextFile(filePath).then((text) => yaml.parse(text))
	)
		.map((toParse: unknown) =>
			playlistBlueprintSchema
				.parseAsync(toParse)
				.catch((error: unknown) => Result.error(fromError(error as Error)))
		)
		.mapError((error) =>
			error instanceof Error
				? error
				: new Error(`Error parsing file: ${filePath}`, {
						cause: error
					})
		)
}

type PlaylistParsed = {
	playlistPath: FilePath
	parseResult: Result<PlaylistBlueprint, Error>
}

// done-refactor: extracted to module scope, takes fileSystem and playlistsDirectory as params
async function parsePlaylistsAll(
	fileSystem: AppFileSystem,
	playlistsDirectory: FilePath
): Promise<Result<readonly PlaylistParsed[], Error>> {
	return Result.fromAsyncCatching(fileSystem.readdir(playlistsDirectory))
		.map((paths) =>
			(paths as string[])
				.filter(isSupportedExtension)
				.map(
					(relativePath) =>
						path.join(playlistsDirectory, relativePath) as FilePath
				)
				.map(
					async (filepath) =>
						({
							playlistPath: filepath,
							parseResult: await parsePlaylistBlueprintFromPath(
								fileSystem,
								filepath
							)
						}) satisfies PlaylistParsed
				)
		)
		.map((promises) => Promise.all(promises))
}

// done-refactor: extracted scanAll implementation to module scope with explicit deps
async function scanAllPlaylists(deps: {
	readonly fileSystem: AppFileSystem
	readonly database: AppDatabase
	readonly addErrorNotification: ErrorNotificationFn
	readonly playlistsDirectory: FilePath
}): Promise<void> {
	const { fileSystem, database, addErrorNotification, playlistsDirectory } =
		deps

	const playlistsParsed = await Result.fromAsync(
		parsePlaylistsAll(fileSystem, playlistsDirectory)
	)
		.onFailure((error) =>
			addErrorNotification("Failed to parse playlists", error)
		)
		.getOrNull()

	if (!playlistsParsed) {
		return
	}

	// Remove deleted smart playlists from database
	const toDelete = await Result.fromAsync(database.getPlaylists())
		.map((playlists) =>
			playlists
				.filter(
					({ id }) =>
						!playlistsParsed.some(
							(parsed) => playlistPathToId(parsed.playlistPath) === id
						)
				)
				.map(({ id }) => id)
		)
		.onFailure((error) =>
			addErrorNotification(
				"Failed to get playlists",
				error,
				"Failed to get playlists during updateSmartPlaylist."
			)
		)
		.getOrDefault([] as PlaylistId[])

	for (const playlistId of toDelete) {
		await Result.fromAsync(database.deletePlaylist(playlistId)).onFailure(
			(error) =>
				addErrorNotification(
					`Failed to remove deleted playlist ${playlistId} from database`,
					error,
					"Failed to remove deleted playlist --"
				)
		)
	}

	// Update smart playlists
	playlistsParsed.forEach(({ parseResult, playlistPath }) =>
		parseResult
			.map((schema) =>
				database.upsertSmartPlaylist({
					schema,
					id: playlistPathToId(playlistPath)
				})
			)
			.onFailure((error) =>
				addErrorNotification(
					`Failed to update smart playlist: ${error}`,
					error,
					"Update smart playlist failed"
				)
			)
	)
}
