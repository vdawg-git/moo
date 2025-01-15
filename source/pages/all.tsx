import { Tracklist } from "#/components/tracklist"
import { database } from "#/database/database"
import { useQuery } from "#/database/query"
import { appState, playNewPlayback } from "#/state/state"
import { Box, Text } from "ink"

export function All() {
	const response = useQuery("all", database.getTracks)

	return (
		<Box>
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
						/>
					),
					(error) => <Text color={"red"}>Error: {String(error)}</Text>
				)
			)}
		</Box>
	)
}
