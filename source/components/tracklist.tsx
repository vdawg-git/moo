import path from "node:path"
import { appConfig } from "#/config/config"
import { useColors } from "#/hooks/useColors"
import { registerKeybinds } from "#/keybindManager/keybindManager"
import { appState } from "#/state/state"
import { List, type ListItem, useList } from "./list"
import type { GeneralCommand } from "#/commands/appCommands"
import type { AppColor } from "#/config/theme"
import type { PlayingState } from "#/types/types"
import type { BaseTrack, TrackId } from "../database/types"

type PlaylistProps = {
	tracks: readonly BaseTrack[]
	onPlay: (index: number) => void
	/** The playing index, not corrected yet when shuffle is on */
	playingIndex?: number | undefined
	/**
	 * If the playlist is shuffled, this is the map of the indexes.
	 * Used to get the correct index of the currently playing track in the list.
	 */
	shuffleMap: readonly number[] | undefined
	playState: PlayingState
}

export function Tracklist({
	tracks,
	onPlay,
	playingIndex: basePlayIndex,
	shuffleMap,
	playState
}: PlaylistProps) {
	const playIndex = shuffleMap ? shuffleMap[basePlayIndex ?? 0] : basePlayIndex

	const listItems: readonly ListItem<BaseTrack>[] = tracks.map(
		(track, index) => ({
			data: track,
			onSelect: () => onPlay(index),
			onFocus: () => registerQueueCommands(track.id),
			render: ({ focused: isFocus }) => (
				<TrackItem
					track={track}
					focused={isFocus}
					state={
						index === playIndex
							? playState === "playing"
								? "playing"
								: "paused"
							: undefined
					}
					key={track.id}
				/>
			)
		})
	)

	const listReturn = useList({
		items: listItems
	})

	return tracks.length === 0 ? (
		<text>No tracks here :(</text>
	) : (
		<List register={listReturn} />
	)
}

export type TrackItemProps = {
	state: "playing" | "paused" | undefined
	track: BaseTrack
	/** Sets the default color. Gets overriden by the `state` color  */
	color?: AppColor
	focused: boolean
}

export function TrackItem({
	state,
	track,
	color,
	focused
}: TrackItemProps): React.ReactNode {
	const colors = useColors()
	const hasPlaybackIndex = !!state
	const bgColor: AppColor | undefined =
		focused && hasPlaybackIndex
			? colors.green
			: focused
				? colors.blue
				: undefined
	const textColor: AppColor | undefined =
		bgColor && hasPlaybackIndex
			? colors.bg
			: hasPlaybackIndex
				? colors.green
				: color

	const titleDisplay = track.title ?? path.basename(track.id)
	const icon = state === "playing" ? appConfig.icons.playingIndicator : ""

	return (
		<box width="100%" backgroundColor={bgColor} height={1} flexDirection="row">
			<text fg={textColor}>
				{icon}
				{"  "}
			</text>

			<text fg={textColor} wrapMode="none">
				{titleDisplay}
			</text>
		</box>
	)
}

/**
 * Returns the unregister function,
 * which should be called when unmounting
 * */
function registerQueueCommands(trackId: TrackId): () => void {
	const commands: GeneralCommand[] = [
		{
			label: "Play next",
			id: "play_next" + trackId,
			callback: () =>
				appState.send({
					type: "addToManualQueueFirst",
					trackId: trackId
				}),
			keybindings: [
				[
					{ key: "q", modifiers: [] },
					{ key: "f", modifiers: [] }
				]
			]
		},
		{
			label: "Play last",
			id: "play_last" + trackId,
			callback: () =>
				appState.send({
					type: "addToManualQueueFirst",
					trackId: trackId
				}),
			keybindings: [
				[
					{ key: "q", modifiers: [] },
					{ key: "l", modifiers: [] }
				]
			]
		}
	]

	return registerKeybinds(commands)
}
