import { TextAttributes } from "@opentui/core"
import { ProgressBar } from "#/components/progressBar"
import { useConfig } from "#/config/configContext"
import { useColors } from "#/hooks/useColors"
import {
	useAppState,
	useCurrentTrack,
	usePlaybackData
} from "#/state/useSelectors"
import type { BaseTrack } from "#/database/types"

export function Playbar() {
	const currentTrack = useCurrentTrack()
	const colors = useColors()

	return (
		<box
			border
			borderStyle={"rounded"}
			height={4}
			borderColor={colors.yellow}
			paddingLeft={1}
			paddingRight={1}
			flexDirection="column"
			zIndex={5}
			backgroundColor={colors.bg}
		>
			<box flexDirection="row" flexGrow={1}>
				<box flexGrow={1} alignItems="flex-start" justifyContent="flex-start">
					{currentTrack ? (
						<TrackDisplay track={currentTrack} />
					) : (
						<text fg={colors.brightBlack}>{"૮₍⎚¯⎚₎ა\n (O_O)"}</text>
					)}
				</box>

				<MediaControl />
			</box>

			<box marginBottom={-1}>
				<ProgressBar />
			</box>
		</box>
	)
}

function MediaControl() {
	const { playState, shuffleMap } = usePlaybackData()
	const hasPlayback = playState !== "stopped"
	const isShuffling = !!shuffleMap
	const colors = useColors()
	const appState = useAppState()
	const config = useConfig()

	return (
		<box flexDirection="column" height={2}>
			<box flexDirection="row">
				<text
					attributes={hasPlayback ? undefined : TextAttributes.DIM}
					onMouseUp={() => appState.send({ type: "previousTrack" })}
					paddingLeft={1}
					paddingRight={1}
					fg={colors.fg}
				>
					{config.icons.previous}
				</text>

				<text
					attributes={hasPlayback ? undefined : TextAttributes.DIM}
					onMouseUp={() => appState.send({ type: "togglePlayback" })}
					paddingLeft={1}
					paddingRight={1}
					fg={colors.fg}
				>
					{playState === "playing" ? config.icons.pause : config.icons.play}
				</text>

				<text
					attributes={hasPlayback ? undefined : TextAttributes.DIM}
					onMouseUp={() => appState.send({ type: "nextTrack" })}
					paddingLeft={1}
					paddingRight={1}
					fg={colors.fg}
				>
					{config.icons.next}
				</text>
			</box>

			<text
				attributes={isShuffling ? undefined : TextAttributes.DIM}
				onMouseUp={() => appState.send({ type: "toggleShuffle" })}
				fg={colors.fg}
			>
				{isShuffling ? config.icons.shuffle : config.icons.linear}
			</text>
		</box>
	)
}

function TrackDisplay({ track }: { track: BaseTrack }) {
	const artist = track.artist ?? track.albumartist
	const colors = useColors()

	return (
		<box paddingLeft={1} flexDirection="column">
			<box>
				<text fg={colors.yellow}>{track.title ?? track.id}</text>
			</box>
			<box>
				<text fg={colors.fg} attributes={TextAttributes.DIM}>
					{artist ?? "Unknown"}
				</text>
			</box>
		</box>
	)
}
