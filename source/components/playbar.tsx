import { appConfig } from "#/config/config"
import type { BaseTrack, Track } from "#/database/types"
import { appState } from "#/state/state"
import { useCurrentTrack, usePlaybackState } from "#/state/useSelectors"
import { Box, Text } from "tuir"

export function Playbar() {
	const currentTrack = useCurrentTrack()

	return (
		<Box flexDirection="column" width={"100%"}>
			<Box borderStyle={"round"} height={4} borderDimColor paddingX={1}>
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

				<MediaControl />
			</Box>
		</Box>
	)
}

function MediaControl() {
	const playbackState = usePlaybackState()
	const hasPlayback = playbackState !== "stopped"

	return (
		<Box>
			<Box
				paddingX={1}
				onClick={() => appState.send({ type: "previousTrack" })}
			>
				<Text dimColor={!hasPlayback}>{appConfig.icons.previous}</Text>
			</Box>

			<Box
				onClick={() => appState.send({ type: "togglePlayback" })}
				paddingX={1}
			>
				<Text dimColor={!hasPlayback}>
					{playbackState === "playing"
						? appConfig.icons.pause
						: appConfig.icons.play}
				</Text>
			</Box>

			<Box paddingX={1} onClick={() => appState.send({ type: "nextTrack" })}>
				<Text dimColor={!hasPlayback}>{appConfig.icons.next}</Text>
			</Box>
		</Box>
	)
}

function TrackDisplay({ track }: { track: BaseTrack }) {
	const artist = track.artist ?? track.albumartist

	return (
		<Box paddingLeft={1} flexDirection="column">
			<Box>
				<Text>{track.title ?? track.id}</Text>
			</Box>
			<Box>
				<Text dimColor>{artist ?? "Unknown"}</Text>
			</Box>
		</Box>
	)
}
