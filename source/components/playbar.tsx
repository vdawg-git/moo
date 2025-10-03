import { Box, Text } from "tuir"
import { appConfig } from "#/config/config"
import { appState } from "#/state/state"
import { useCurrentTrack, usePlaybackData } from "#/state/useSelectors"
import type { BaseTrack } from "#/database/types"

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
	const { playState, shuffleMap } = usePlaybackData()
	const hasPlayback = playState !== "stopped"
	const isShuffling = !!shuffleMap

	return (
		<Box flexDirection="column">
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
						{playState === "playing"
							? appConfig.icons.pause
							: appConfig.icons.play}
					</Text>
				</Box>

				<Box paddingX={1} onClick={() => appState.send({ type: "nextTrack" })}>
					<Text dimColor={!hasPlayback}>{appConfig.icons.next}</Text>
				</Box>
			</Box>

			<Box>
				<Box onClick={() => appState.send({ type: "toggleShuffle" })}>
					<Text dimColor={!isShuffling}>
						{isShuffling ? appConfig.icons.shuffle : appConfig.icons.linear}
					</Text>
				</Box>
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
