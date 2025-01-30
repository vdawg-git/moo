import { basename } from "node:path"
import { playlistsChanged$ } from "./parsing"
import type { PlaylistSchema } from "./schema"
import type { PlaylistId } from "#/database/types"
import type { Result } from "typescript-result"
import { addErrorNotification } from "#/state/state"
import type { Subscription } from "rxjs"

export function watchPlaylists(): Subscription {
	return playlistsChanged$.subscribe(({ parseResult, playlistPath }) => {
		const playlistId = basename(playlistPath) as PlaylistId

		parseResult
			.map(playlistSchemaToSql)
			.map((sql) =>
				updatePlaylist({
					id: playlistId,
					updateSql: sql
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

export async function updatePlaylist({
	id,
	updateSql
}: { id: PlaylistId; updateSql: string }): Promise<Result<void, Error>> {}

function playlistSchemaToSql(schema: PlaylistSchema): string {}
