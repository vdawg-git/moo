import { useSelector } from "@xstate/store/react"
import { Box, Text } from "tuir"
import { Playbar } from "#/components/playbar"
import { Tracklist } from "#/components/tracklist"
import { database } from "#/database/database"
import { useQuery } from "#/database/useQuery"
import { appState, playNewPlayback } from "#/state/state"
import { usePlayingIndex } from "#/state/useSelectors"

export function All() {
	const response = useQuery("all", database.getTracks)
	const playingIndex = usePlayingIndex({ type: "all" })
	const playState = useSelector(
		appState,
		(snapshot) => snapshot.context.playback.playState
	)
	const amount = response.data?.getOrNull()?.length

	return (
		<>
			<Box flexGrow={1} flexDirection="column">
				<Text color={"magenta"} bold>
					All tracks{" "}
					<Text color={"gray"}>{amount ? `(${amount} tracks)` : ""}</Text>
				</Text>
				{response.isLoading ? (
					<Text>Loading...</Text>
				) : (
					response.data.fold(
						(tracks) => (
							<Tracklist
								tracks={tracks}
								playState={playState}
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
