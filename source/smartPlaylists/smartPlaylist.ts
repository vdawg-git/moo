import path, { basename, extname } from "node:path"
import { match, P } from "ts-pattern"
import { Result } from "typescript-result"
import { logger } from "#/logs"
import {
	getPlaylistBlueprintFromId,
	parsePlaylistsAll,
	playlistsChanged$
} from "./parsing"
import type { AppDatabase, PlaylistId } from "#/database/types"
import type { ErrorNotificationFn, FilePath } from "#/types/types"
import type { Subscription } from "rxjs"

type SmartPlaylistDeps = {
	readonly database: AppDatabase
	readonly addErrorNotification: ErrorNotificationFn
}

export async function updateSmartPlaylists({
	database,
	addErrorNotification
}: SmartPlaylistDeps): Promise<void> {
	const playlistsParsed = await Result.fromAsync(parsePlaylistsAll())
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

export function watchPlaylists({
	database,
	addErrorNotification
}: SmartPlaylistDeps): Subscription {
	return playlistsChanged$.subscribe(async ({ playlistPath, event }) => {
		const playlistId = basename(
			playlistPath,
			extname(playlistPath)
		) as PlaylistId
		logger.debug("playlist changed", { playlistId, playlistPath, event })

		await match(event)
			.with(P.union("add", "change"), () =>
				getPlaylistBlueprintFromId(playlistId)
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
}

function playlistPathToId(filepath: FilePath): PlaylistId {
	return path.basename(filepath, ".yml") as PlaylistId
}
