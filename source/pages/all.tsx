import { Playbar } from "#/components/playbar"
import { Tracklist } from "#/components/tracklist"
import { database } from "#/database/database"
import { useQuery } from "#/database/query"
import { playNewPlayback } from "#/state/state"
import { usePlayingIndex } from "#/state/useSelectors"
import { Box, Text } from "tuir"

export function All() {
	const response = useQuery("all", database.getTracks)
	const playingIndex = usePlayingIndex({ type: "all" })
	const amount = response.data?.getOrNull()?.length

	return (
		<>
			<Box flexGrow={1} flexDirection="column">
				<Text color={"magenta"} bold>
					All tracks {amount ? `(${amount} tracks)` : ""}
				</Text>

				{response.isLoading ? (
					<Text>Loading...</Text>
				) : (
					response.data.fold(
						(tracks) => (
							<Tracklist
								tracks={tracks}
								onChange={(index) =>
									playNewPlayback({
										source: { type: "all" },
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
