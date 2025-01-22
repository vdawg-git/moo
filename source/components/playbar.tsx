import { appConfig } from "#/config/config"
import type { Track } from "#/database/types"
import { appState } from "#/state/state"
import { useCurrentTrack, usePlaybackState } from "#/state/useSelectors"
import { match } from "ts-pattern"
import { Box, Text } from "tuir"

export function Playbar() {
	const currentTrack = useCurrentTrack()
	const playbackState = usePlaybackState()

	return (
		<Box flexDirection="column" width={"100%"}>
			<Box borderStyle={"round"} borderDimColor paddingX={1}>
				<Box flexGrow={1}>
					{currentTrack ? (
						<TrackDisplay track={currentTrack} />
					) : (
						<Box alignSelf="center">
							<Text dimColor color={"gray"} italic>
								Moo
							</Text>
						</Box>
					)}
				</Box>

				<Text dimColor={playbackState !== "playing"}>[ {playbackState} ]</Text>
			</Box>

			{/* <MediaControl /> */}
		</Box>
	)
}

function MediaControl() {
	const playbackState = usePlaybackState()
	const hasPlayback = playbackState !== "stopped"

	return (
		<Box>
			<Box padding={2} onClick={() => appState.send({ type: "previousTrack" })}>
				<Text dimColor={!hasPlayback}>{appConfig.icons.previous}</Text>
			</Box>

			<Box
				onClick={() => appState.send({ type: "togglePlayback" })}
				padding={2}
			>
				<Text dimColor={!hasPlayback}>
					{playbackState === "playing"
						? appConfig.icons.pause
						: appConfig.icons.play}
				</Text>
			</Box>

			<Box padding={2} onClick={() => appState.send({ type: "nextTrack" })}>
				<Text dimColor={!hasPlayback}>{appConfig.icons.next}</Text>
			</Box>
		</Box>
	)
}

function TrackDisplay({ track }: { track: Track }) {
	const artist = track.artist ?? track.albumartist

	return (
		<Box paddingLeft={1} flexDirection="column">
			<Text>{track.title ?? track.id}</Text>
			<Text dimColor>{artist ?? "Unknown"}</Text>
		</Box>
	)
}
