import { useCallback } from "react"
import { Playbar } from "#/components/playbar"
import { PlaylistTitle } from "#/components/playlilstTitle"
import { Tracklist } from "#/components/tracklist"
import { database } from "#/database/database"
import { useQuery } from "#/database/useQuery"
import { useColors } from "#/hooks/useColors"
import { createQueryKey } from "#/queryKey"
import { playNewPlayback } from "#/state/state"
import { usePlaybackData, usePlayingIndex } from "#/state/useSelectors"
import type { PlaylistId } from "#/database/types"
import { LoadingText } from "#/components/loadingText"

type PlaylistProps = {
	id: PlaylistId
}

export function PlaylistPage({ id }: PlaylistProps) {
	const query = useCallback(() => database.getPlaylist(id), [id])
	const response = useQuery(createQueryKey.playlist(id), query)
	const playingIndex = usePlayingIndex({ type: "playlist", id })
	const playback = usePlaybackData()
	const amount = response.data?.getOrNull()?.tracks.length
	const displayName = response.data?.getOrNull()?.displayName ?? id
	const colors = useColors()

	return (
		<>
			<box flexGrow={1} flexDirection="column">
				<PlaylistTitle title={displayName} tracksAmount={amount ?? 0} />

				{response.isLoading ? (
					<LoadingText />
				) : (
					response.data.fold(
						(playlist) => (
							<Tracklist
								tracks={playlist.tracks}
								onPlay={(index) =>
									playNewPlayback({
										source: { type: "playlist", id },
										index
									})
								}
								shuffleMap={playback.shuffleMap}
								playState={playback.playState}
								playingIndex={playingIndex}
								// A bit weird, but useList needs that
								key={JSON.stringify(playlist.tracks)}
							/>
						),
						(error) => <text fg={colors.red}>Error: {String(error)}</text>
					)
				)}
			</box>

			<Playbar />
		</>
	)
}
