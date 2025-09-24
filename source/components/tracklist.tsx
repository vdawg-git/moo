import path from "node:path"
import { useEffect, useId } from "react"
import {
	Box,
	type Color,
	List,
	Text,
	useKeymap,
	useList,
	useListItem
} from "tuir"
import type { GeneralCommand } from "#/commands/appCommands"
import { appConfig } from "#/config/config"
import { registerKeybinds } from "#/keybindManager/KeybindManager"
import type { PlayingState } from "#/types/types"
import type { BaseTrack, TrackId } from "../database/types"
import { appState } from "#/state/state"
import { useRegisterListNavigationCommands } from "#/hooks/hooks"

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
	const { listView, items, control } = useList(tracks, {
		windowSize: "fit",
		unitSize: 1,
		navigation: "none",
		centerScroll: false,
		fallthrough: false
	})

	const uid = useId()
	const playIndex = shuffleMap ? shuffleMap[basePlayIndex ?? 0] : basePlayIndex

	useRegisterListNavigationCommands({
		control,
		itemsLength: items.length,
		uid: uid + "-tracklist"
	})

	return (
		<Box flexDirection="column">
			{items.length === 0 && <Text>No tracks here :(</Text>}

			<List
				listView={listView}
				batchMap={{
					batchSize: 200,
					items: tracks,
					map: (track, index) => (
						<TrackItem
							track={track}
							state={
								index === playIndex
									? playState === "playing"
										? "playing"
										: "paused"
									: undefined
							}
							key={track.id}
							onPlay={() => onPlay(index)}
							onFocus={() => registerQueueCommands(track.id)}
						/>
					)
				}}
			/>
		</Box>
	)
}

export type TrackItemProps = {
	state: "playing" | "paused" | undefined
	onPlay: () => void
	/**
	 * Gets executed when the element gets focused.
	 * If a function is returned it will be called onBlur
	 */
	onFocus?: () => undefined | (() => void)
	// we pass those instead of using them from `useListItem`, as sometimes the item is undefined
	// still not sure though if this is really the bug, but it looks like it
	track: BaseTrack
	/** Sets the default color. Gets overriden by the `state` color  */
	color?: Color
}

export function TrackItem({
	onPlay: onSelect,
	state,
	track,
	onFocus,
	color
}: TrackItemProps): React.ReactNode {
	const { isFocus, control, listIndex } = useListItem<BaseTrack[]>()

	const hasPlaybackIndex = !!state
	const bgColor: Color | undefined =
		isFocus && hasPlaybackIndex ? "green" : isFocus ? "blue" : undefined
	const textColor: Color | undefined =
		bgColor && hasPlaybackIndex ? "black" : hasPlaybackIndex ? "green" : color

	const titleDisplay = track.title ?? path.basename(track.id)

	const { useEvent } = useKeymap({ submit: { key: "return" } })
	useEvent("submit", onSelect)
	const icon = state === "playing" ? appConfig.icons.playingIndicator : ""

	useEffect(() => {
		if (!isFocus) return

		return onFocus?.()
	}, [isFocus, onFocus])

	return (
		<Box
			width="100"
			backgroundColor={bgColor}
			onClick={() => (isFocus ? onSelect() : control.goToIndex(listIndex))}
		>
			<Text color={textColor}>
				{icon}
				{"  "}
			</Text>

			<Text color={textColor} wrap="truncate-end">
				{titleDisplay}
			</Text>
		</Box>
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
