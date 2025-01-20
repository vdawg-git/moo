import { appConfig } from "#/config/config"
import type { Track } from "#/database/types"
import { appState } from "#/state/state"
import { useCurrentTrack, usePlaybackState } from "#/state/useSelectors"
import { Box, Text } from "tuir"

export function Playbar() {
	const currentTrack = useCurrentTrack()

	return (
		<Box
			flexDirection="column"
			width={"100%"}
			borderColor={"gray"}
			borderStyle={"round"}
			justifyContent="center"
			alignItems="center"
		>
			<Box height={3}>
				{currentTrack && <TrackDisplay track={currentTrack} />}
			</Box>

			<MediaControl />
		</Box>
	)
}

function MediaControl() {
	const playbackState = usePlaybackState()
	const hasPlayback = playbackState !== "stopped"

	return (
		<Box>
			<Box padding={1} onClick={() => appState.send({ type: "previousTrack" })}>
				<Text dimColor={!hasPlayback}>{appConfig.icons.previous}</Text>
			</Box>

			<Box
				padding={2}
				onClick={() => appState.send({ type: "togglePlayback" })}
			>
				<Text dimColor={!hasPlayback}>
					{playbackState === "playing"
						? appConfig.icons.pause
						: appConfig.icons.play}
				</Text>
			</Box>

			<Box padding={1} onClick={() => appState.send({ type: "nextTrack" })}>
				<Text dimColor={!hasPlayback}>{appConfig.icons.next}</Text>
			</Box>
		</Box>
	)
}

function TrackDisplay({ track }: { track: Track }) {
	const artist = track.artist ?? track.albumartist

	return (
		<Box flexDirection="column">
			<Text>{track.title ?? track.id}</Text>
			<Text dimColor>{artist ?? "Unknown"}</Text>
		</Box>
	)
}
