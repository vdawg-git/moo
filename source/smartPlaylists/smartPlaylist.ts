import { database } from "#/database/database"
import type { PlaylistId } from "#/database/types"
import { addErrorNotification } from "#/state/state"
import path, { basename } from "node:path"
import type { Subscription } from "rxjs"
import { parsePlaylists, playlistsChanged$ } from "./parsing"
import { Result } from "typescript-result"
import * as R from "remeda"
import type { FilePath } from "#/types/types"

export async function updateSmartPlaylists(): Promise<void> {
	const parsed = await Result.fromAsync(parsePlaylists())
		.map(
			R.piped(
				R.map(({ parseResult, playlistPath }) =>
					parseResult.map((schema) =>
						database.upsertSmartPlaylist({
							schema,
							id: playlistPathToId(playlistPath)
						})
					)
				),
				(updateResults) => Promise.all(updateResults)
			)
		)
		.fold(
			(updateResults) => updateResults,
			(accessError) => [Result.error(accessError)]
		)

	parsed.forEach((updateResult) =>
		updateResult.onFailure((error) =>
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

		parseResult
			.map((schema) =>
				database.upsertSmartPlaylist({
					id: playlistId,
					schema
				})
			)
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
	return path.basename(filepath, "yml") as PlaylistId
}
