import { Playbar } from "#/components/playbar"
import { Tracklist } from "#/components/tracklist"
import { database } from "#/database/database"
import type { PlaylistId } from "#/database/types"
import { useQuery } from "#/database/useQuery"
import { playNewPlayback } from "#/state/state"
import { usePlayingIndex } from "#/state/useSelectors"
import { Box, Text } from "tuir"

type PlaylistProps = {
	id: PlaylistId
}

export function Playlist({ id }: PlaylistProps) {
	const response = useQuery(["playlist", id], () => database.getPlaylist(id))
	const playingIndex = usePlayingIndex({ type: "playlist", id })
	const amount = response.data?.getOrNull()?.tracks.length
	const displayName = response.data?.getOrNull()?.displayName ?? id

	return (
		<>
			<Box flexGrow={1} flexDirection="column">
				<Text color={"magenta"} bold>
					{displayName}{" "}
					<Text color={"gray"}>{amount ? `(${amount} tracks)` : ""}</Text>
				</Text>

				{response.isLoading ? (
					<Text>Loading...</Text>
				) : (
					response.data.fold(
						(playlist) => (
							<Tracklist
								tracks={playlist?.tracks}
								onChange={(index) =>
									playNewPlayback({
										source: { type: "playlist", id },
										index
									})
								}
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
