import type { Track } from "#/database/types"
import { useCurrentTrack } from "#/state/useSelectors"
import { Box, Text } from "ink"

export function Playbar() {
	const currentTrack = useCurrentTrack()
	return (
		<Box width={"100%"} borderColor={"gray"} borderStyle={"round"}>
			{currentTrack && <TrackDisplay track={currentTrack} />}
		</Box>
	)
}

function TrackDisplay({ track }: { track: Track }) {
	const artist = track.artist ?? track.albumartist

	return (
		<Box>
			<Text>{track.title ?? track.id}</Text>
			{artist && <Text>{artist}</Text>}
		</Box>
	)
}
