import { useCallback } from "react"
import { Box, Text } from "tuir"
import { Playbar } from "#/components/playbar"
import { PlaylistTitle } from "#/components/playlilstTitle"
import { Tracklist } from "#/components/tracklist"
import { database } from "#/database/database"
import type { PlaylistId } from "#/database/types"
import { useQuery } from "#/database/useQuery"
import { playNewPlayback } from "#/state/state"
import { usePlaybackData, usePlayingIndex } from "#/state/useSelectors"

type PlaylistProps = {
	id: PlaylistId
}

export function Playlist({ id }: PlaylistProps) {
	const query = useCallback(() => database.getPlaylist(id), [id])
	const response = useQuery(["playlist", id], query)
	const playingIndex = usePlayingIndex({ type: "playlist", id })
	const playback = usePlaybackData()
	const amount = response.data?.getOrNull()?.tracks.length
	const displayName = response.data?.getOrNull()?.displayName ?? id

	return (
		<>
			<Box flexGrow={1} flexDirection="column">
				<PlaylistTitle title={displayName} tracksAmount={amount ?? 0} />

				{response.isLoading ? (
					<Text>Loading...</Text>
				) : (
					response.data.fold(
						(playlist) => (
							<Tracklist
								tracks={playlist.tracks}
								onChange={(index) =>
									playNewPlayback({
										source: { type: "playlist", id },
										index
									})
								}
								shuffleMap={playback.shuffleMap}
								playState={playback.playState}
								playingIndex={playingIndex}
							/>
						),
						(error) => <Text color={"red"}>Error: {String(error)}</Text>
					)
				)}
			</Box>

			<Playbar />
		</>
	)
}
