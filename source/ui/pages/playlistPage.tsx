import { useCallback } from "react"
import { useAppContext } from "#/app/context"
import { createQueryKey } from "#/shared/queryKey"
import { LoadingText } from "#/ui/components/loadingText"
import { Playbar } from "#/ui/components/playbar"
import { PlaylistTitle } from "#/ui/components/playlistTitle"
import { Tracklist } from "#/ui/components/tracklist"
import { useColors } from "#/ui/hooks/useColors"
import { useQuery } from "#/ui/hooks/useQuery"
import { usePlaybackData, usePlayingIndex } from "#/ui/hooks/useSelectors"
import type { PlaylistId } from "#/ports/database"

type PlaylistProps = {
	id: PlaylistId
}

export function PlaylistPage({ id }: PlaylistProps) {
	const { database, playNewPlayback } = useAppContext()
	const queryFn = useCallback(() => database.getPlaylist(id), [id, database])
	const response = useQuery(createQueryKey.playlist(id), queryFn)
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
								key={id}
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
