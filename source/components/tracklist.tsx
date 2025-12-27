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
import { QuickEditModal } from "./quickEditModal"
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
		onFocusItem: ({ data: track }) => registerTrackCommands(track),
		searchKeys: [
			{ name: "title", getFunction: (item) => item.title ?? item.id }
		]
	})

	const colors = useColors()

	return tracks.length === 0 ? (
		<box padding={1}>
			<text fg={colors.yellow}>No tracks here :(</text>
		</box>
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
	const icon =
		state === "playing"
			? appConfig.icons.playingIndicator
			: state === "paused"
				? appConfig.icons.pause
				: ""

	return (
		<box width="100%" backgroundColor={bgColor} height={1} flexDirection="row">
			<box width={3} overflow="hidden">
				<text width={3} fg={textColor}>
					{icon}{" "}
				</text>
			</box>

			<box width={"50%"} paddingRight={3} overflow="hidden">
				<text
					fg={textColor}
					wrapMode="none"
					overflow="hidden"
					attributes={hasPlaybackIndex ? TextAttributes.BOLD : undefined}
				>
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
function registerTrackCommands(track: BaseTrack): () => void {
	const { id, title } = track

	const commands: GeneralCommandArgument[] = [
		{
			label: "Play next",
			id: "play_next" + id,
			callback: () =>
				appState.send({
					type: "addToManualQueueFirst",
					trackId: id
				}),
			keybindings: keybinding("q f")
		},
		{
			label: "Play last",
			id: "play_last" + id,
			callback: () =>
				appState.send({
					type: "addToManualQueueFirst",
					trackId: id
				}),
			keybindings: keybinding("q l")
		},
		{
			label: "Quick tag",
			id: "quick_tag" + id,
			keybindings: keybinding("t e"),
			callback: () =>
				appState.send({
					type: "addModal",
					modal: {
						id: "quick_tag" + id,
						title: "Quick Edit",
						Content: (modal) => <QuickEditModal track={track} modal={modal} />
					}
				})
		}
	]

	return registerKeybinds(commands)
}
