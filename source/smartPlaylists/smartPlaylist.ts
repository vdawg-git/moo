import { database } from "#/database/database"
import type { PlaylistId } from "#/database/types"
import { addErrorNotification } from "#/state/state"
import path, { basename } from "node:path"
import type { Subscription } from "rxjs"
import { parsePlaylistsAll, playlistsChanged$ } from "./parsing"
import { Result } from "typescript-result"
import type { FilePath } from "#/types/types"
import { logg } from "#/logs"

export async function updateSmartPlaylists(): Promise<void> {
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

export function watchPlaylists(): Subscription {
	return playlistsChanged$.subscribe(({ parseResult, playlistPath }) => {
		const playlistId = basename(playlistPath) as PlaylistId
		logg.debug("playlist changed", { playlistId, playlistPath })

		parseResult
			.map((schema) =>
				database.upsertSmartPlaylist({
					id: playlistId,
					schema
				})
			)
			.onSuccess(() => {
				logg.silly("Updated smart-playlist", { playlistId, playlistPath })
			})
			.onFailure((error) =>
				addErrorNotification(
					`Failed to update playlist "${playlistId}"\n${error.message}`,
					{ error, playlistId },
					"Failed playlist update"
				)
			)
	})
}

function playlistPathToId(filepath: FilePath): PlaylistId {
	return path.basename(filepath, ".yml") as PlaylistId
}
