import path from "node:path"
import { TextAttributes } from "@opentui/core"
import { useRef } from "react"
import { appConfig } from "#/config/config"
import { useColors } from "#/hooks/useColors"
import {
	type GeneralCommandArgument,
	registerKeybinds
} from "#/keybindManager/keybindManager"
import { keybinding } from "#/lib/keybinds"
import { appState } from "#/state/state"
import { List, useList } from "./list"
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

	const onPlayRef = useRef<PlaylistProps["onPlay"]>(null)
	if (!onPlayRef.current) {
		onPlayRef.current = onPlay
	}

	const listReturn = useList({
		items: tracks,
		onSelect: ({ index }) => onPlayRef.current?.(index),
		onFocusItem: ({ data: track }) => registerQueueCommands(track.id),
		searchKeys: [
			{ name: "title", getFunction: (item) => item.title ?? item.id }
		]
	})

	return tracks.length === 0 ? (
		<text>No tracks here :(</text>
	) : (
		<List
			register={listReturn}
			render={(track, { focused: isFocus, indexDisplayed }) => (
				<TrackItem
					track={track}
					focused={isFocus}
					state={
						indexDisplayed === playIndex
							? playState === "playing"
								? "playing"
								: "paused"
							: undefined
					}
					key={track.id}
				/>
			)}
		/>
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
	const textColor: AppColor | undefined = bgColor
		? colors.bg
		: hasPlaybackIndex
			? colors.green
			: (color ?? colors.fg)

	const titleDisplay = track.title ?? path.basename(track.id)
	const artistDisplay = track.artist ?? track.albumartist ?? ""
	const icon = state === "playing" ? appConfig.icons.playingIndicator : ""

	return (
		<box width="100%" backgroundColor={bgColor} height={1} flexDirection="row">
			<box width={2} overflow="hidden">
				<text fg={textColor}>
					{icon}
					{"  "}
				</text>
			</box>

			<box width={"50%"} paddingRight={3} overflow="hidden">
				<text fg={textColor} wrapMode="none" overflow="hidden">
					{titleDisplay}
				</text>
			</box>

			<box overflow="hidden" width={"50%"}>
				<text
					fg={textColor}
					attributes={focused ? undefined : TextAttributes.DIM}
					wrapMode="none"
				>
					{artistDisplay}
				</text>
			</box>
		</box>
	)
}

/**
 * Returns the unregister function,
 * which should be called when unmounting
 * */
function registerQueueCommands(trackId: TrackId): () => void {
	const commands: GeneralCommandArgument[] = [
		{
			label: "Play next",
			id: "play_next" + trackId,
			callback: () =>
				appState.send({
					type: "addToManualQueueFirst",
					trackId: trackId
				}),
			keybindings: keybinding("q f")
		},
		{
			label: "Play last",
			id: "play_last" + trackId,
			callback: () =>
				appState.send({
					type: "addToManualQueueFirst",
					trackId: trackId
				}),
			keybindings: keybinding("q l")
		}
	]

	return registerKeybinds(commands)
}
