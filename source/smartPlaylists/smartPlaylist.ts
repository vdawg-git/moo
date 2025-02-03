import { database } from "#/database/database"
import type { PlaylistId } from "#/database/types"
import { addErrorNotification } from "#/state/state"
import { basename } from "node:path"
import type { Subscription } from "rxjs"
import { playlistsChanged$ } from "./parsing"

export function watchPlaylists(): Subscription {
	return playlistsChanged$.subscribe(({ parseResult, playlistPath }) => {
		const playlistId = basename(playlistPath) as PlaylistId

		parseResult
			.map((schema) =>
				database.updateSmartPlaylist({
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
