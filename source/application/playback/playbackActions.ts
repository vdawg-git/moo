import { match } from "ts-pattern"
import { Result } from "typescript-result"
import type { AppStore } from "#/core/state/state"
import type { PlaybackSource } from "#/core/state/types"
import type { AppDatabase, BaseTrack } from "#/ports/database"
import type { ErrorNotificationFn } from "#/shared/types/types"

export function createPlaybackActions({
	database,
	appState,
	addErrorNotification
}: {
	readonly database: AppDatabase
	readonly appState: AppStore
	readonly addErrorNotification: ErrorNotificationFn
}) {
	async function playNewPlayback({
		source,
		index
	}: {
		source: PlaybackSource
		index?: number
	}) {
		const state = appState.getSnapshot().context.playback

		const isSamePlayback =
			index === state.index && source.type === state.queue?.source.type
		if (isSamePlayback) {
			appState.send({ type: "togglePlayback" })
			return
		}

		const data = await fetchPlaybackSource(source)

		data
			.onSuccess((tracks) => {
				appState.send({
					type: "playNewPlayback",
					queue: { tracks: tracks.map(({ id }) => id), source },
					index
				})
			})
			.onFailure((error) => {
				addErrorNotification("Failed to start new playback", error)
			})
	}

	function fetchPlaybackSource(
		source: PlaybackSource
	): Promise<Result<readonly BaseTrack[], Error>> {
		return match(source)
			.returnType<Promise<Result<readonly BaseTrack[], Error>>>()

			.with({ type: "all" }, () => database.getTracks())

			.with({ type: "playlist" }, ({ id }) =>
				database
					.getPlaylist(id)
					.then((response) =>
						response.map(
							(playlist) =>
								playlist?.tracks
								?? Result.error(new Error("Playlist not found"))
						)
					)
			)

			.with({ type: "album" }, ({ id }) =>
				database
					.getAlbum(id)
					.map((album) =>
						album
							? album.tracks
							: Result.error(new Error(`Album not found: ${id}`))
					)
			)

			.with({ type: "artist" }, ({ id }) =>
				database
					.getArtist(id)
					.map((artist) =>
						artist
							? artist.tracks
							: Result.error(new Error(`Artist not found: ${id}`))
					)
			)

			.exhaustive()
	}

	return { playNewPlayback }
}
