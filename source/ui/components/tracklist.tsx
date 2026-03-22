import path from "node:path"
import { TextAttributes } from "@opentui/core"
import { useRef } from "react"
import { useAppContext } from "#/app/context"
import { useConfig } from "#/shared/config/configContext"
import { keybinding } from "#/shared/library/keybinds"
import { useColors } from "#/ui/hooks/useColors"
import { List, useList } from "./list"
import type {
	GeneralCommandArgument,
	KeybindManager
} from "#/application/keybinds/keybindManager"
import type { AppStore } from "#/core/state/state"
import type { BaseTrack } from "#/ports/database"
import type { AppColor } from "#/shared/config/theme"
import type { PlayingState } from "#/shared/types/types"

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
	const { appState, keybindManager } = useAppContext()
	const playIndex =
		basePlayIndex !== undefined && shuffleMap
			? shuffleMap[basePlayIndex]
			: basePlayIndex

	const onPlayRef = useRef<PlaylistProps["onPlay"]>(onPlay)
	onPlayRef.current = onPlay

	const { register } = useList({
		items: tracks,
		centerOnIndex: playIndex,
		onSelect: ({ index }) => onPlayRef.current?.(index),
		onFocusItem: ({ data: track }) =>
			registerTrackCommands(track, appState, keybindManager),
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
			register={register}
			render={(track, { focused: isFocus, indexItem }) => (
				<TrackItem
					track={track}
					focused={isFocus}
					state={
						indexItem === playIndex
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

	const config = useConfig()
	const titleDisplay = track.title ?? path.basename(track.id)
	const artistDisplay = track.artist ?? track.albumartist ?? ""
	const icon =
		state === "playing"
			? config.icons.playingIndicator
			: state === "paused"
				? config.icons.pause
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
function registerTrackCommands(
	track: BaseTrack,
	appState: AppStore,
	keybindManager: KeybindManager
): () => void {
	const { id } = track

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
					type: "addToManualQueueLast",
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
					type: "navigateTo",
					goTo: { route: "quickEdit", parameter: { id } }
				})
		}
	]

	return keybindManager.registerKeybinds(commands)
}
