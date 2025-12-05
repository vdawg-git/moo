import { TextAttributes } from "@opentui/core"
import { appConfig } from "#/config/config"
import { useColors } from "#/hooks/useColors"
import { appState } from "#/state/state"
import { useCurrentTrack, usePlaybackData } from "#/state/useSelectors"
import type { BaseTrack } from "#/database/types"

export function Playbar() {
	const currentTrack = useCurrentTrack()
	const colors = useColors()

	return (
		<box
			border
			borderStyle={"rounded"}
			height={4}
			borderColor={colors.fg}
			paddingLeft={1}
			paddingRight={1}
			flexDirection="row"
		>
			<box flexGrow={1} alignItems="flex-start" justifyContent="flex-start">
				{currentTrack ? (
					<TrackDisplay track={currentTrack} />
				) : (
					<text fg={colors.brightBlack}>{"^^\n(oo)"}</text>
				)}
			</box>

			<MediaControl />
		</box>
	)
}

function MediaControl() {
	const { playState, shuffleMap } = usePlaybackData()
	const hasPlayback = playState !== "stopped"
	const isShuffling = !!shuffleMap

	return (
		<box flexDirection="column" height={2}>
			<box flexDirection="row">
				<box
					onMouse={() => appState.send({ type: "previousTrack" })}
					paddingLeft={1}
					paddingRight={1}
				>
					<text attributes={hasPlayback ? undefined : TextAttributes.DIM}>
						{appConfig.icons.previous}
					</text>
				</box>

				<box
					onMouse={() => appState.send({ type: "togglePlayback" })}
					paddingLeft={1}
					paddingRight={1}
				>
					<text attributes={hasPlayback ? undefined : TextAttributes.DIM}>
						{playState === "playing"
							? appConfig.icons.pause
							: appConfig.icons.play}
					</text>
				</box>

				<box
					onMouse={() => appState.send({ type: "nextTrack" })}
					paddingLeft={1}
					paddingRight={1}
				>
					<text attributes={hasPlayback ? undefined : TextAttributes.DIM}>
						{appConfig.icons.next}
					</text>
				</box>
			</box>

			<box onMouseUp={() => appState.send({ type: "toggleShuffle" })}>
				<text attributes={isShuffling ? undefined : TextAttributes.DIM}>
					{isShuffling ? appConfig.icons.shuffle : appConfig.icons.linear}
				</text>
			</box>
		</box>
	)
}

function TrackDisplay({ track }: { track: BaseTrack }) {
	const artist = track.artist ?? track.albumartist

	return (
		<box paddingLeft={1} flexDirection="column">
			<box>
				<text>{track.title ?? track.id}</text>
			</box>
			<box>
				<text attributes={TextAttributes.DIM}>{artist ?? "Unknown"}</text>
			</box>
		</box>
	)
}
