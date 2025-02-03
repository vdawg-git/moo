import { basename } from "node:path"
import { parsePlaylists, playlistsChanged$ } from "./parsing"
import type { PlaylistSchema } from "./schema"
import type { PlaylistId } from "#/database/types"
import { Result } from "typescript-result"
import { addErrorNotification } from "#/state/state"
import type { Subscription } from "rxjs"
import * as R from "remeda"
import { logg } from "#/logs"
import { database } from "#/database/database"

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
