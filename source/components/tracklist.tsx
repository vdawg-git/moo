import path from "node:path"
import { useCallback, useEffect, useState } from "react"
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
import {
	registerKeybinds,
	unregisterKeybinds
} from "#/keybindManager/KeybindManager"
import type { PlayingState } from "#/types/types"
import type { BaseTrack } from "../database/types"

type PlaylistProps = {
	tracks: readonly BaseTrack[]
	onChange: (index: number) => void
	playingIndex?: number | undefined
	playState: PlayingState
}

export function Tracklist({
	tracks,
	onChange,
	playingIndex,
	playState
}: PlaylistProps) {
	const { listView, items, control } = useList(tracks, {
		windowSize: "fit",
		unitSize: 1,
		navigation: "none",
		centerScroll: false,
		fallthrough: false
	})

	const uid = useState(crypto.randomUUID())

	const goDown = useCallback(() => control.nextItem(), [control])
	const goUp = useCallback(() => control.prevItem(), [control])
	const goBottom = useCallback(
		() => control.goToIndex(items.length - 1),
		[control, items]
	)
	const goTop = useCallback(() => control.goToIndex(0), [control])
	const scrollDown = useCallback(() => control.scrollDown(), [control])
	const scrollUp = useCallback(() => control.scrollUp(), [control])

	useEffect(() => {
		const commands: GeneralCommand[] = [
			{
				id: "down" + uid,
				callback: goDown,
				label: "Go to the next track list item",
				keybindings: [
					[{ key: "j", modifiers: [] }],
					[{ key: "down", modifiers: [] }]
				]
			},
			{
				id: "up" + uid,
				callback: goUp,
				label: "Go to the previous track list item",
				keybindings: [
					[{ key: "k", modifiers: [] }],
					[{ key: "down", modifiers: [] }]
				]
			},
			{
				id: "bottom" + uid,
				callback: goBottom,
				label: "Go to the last list item",
				keybindings: [[{ key: "G", modifiers: [] }]]
			},
			{
				id: "top" + uid,
				callback: goTop,
				label: "Go to the first list item",
				keybindings: [
					[
						{ key: "g", modifiers: [] },
						{ key: "g", modifiers: [] }
					]
				]
			},
			{
				id: "scrollDown" + uid,
				callback: scrollDown,
				label: "Scroll the track list down",
				keybindings: [[{ key: "d", modifiers: ["ctrl"] }]]
			},
			{
				id: "scrollUp" + uid,
				callback: scrollUp,
				label: "Scroll the track list up",
				keybindings: [[{ key: "u", modifiers: ["ctrl"] }]]
			}
		]

		registerKeybinds(commands)

		return () => {
			unregisterKeybinds(commands)
		}
	}, [goDown, goUp, goBottom, goTop, scrollDown, scrollUp, uid])

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
							index={index}
							state={
								index === playingIndex
									? playState === "playing"
										? "playing"
										: "paused"
									: undefined
							}
							key={track.id}
							onSelect={() => onChange(index)}
						/>
					)
				}}
			/>
		</Box>
	)
}

type TrackItemProps = {
	state: "playing" | "paused" | undefined
	onSelect: () => void
	// we pass those instead of using them from `useListItem`, as sometimes the item is undefined
	// still not sure though if this is really the bug, but it looks like it
	track: BaseTrack
	index: number
}

function TrackItem({
	onSelect,
	state,
	track,
	index
}: TrackItemProps): React.ReactNode {
	const { isFocus, control } = useListItem<BaseTrack[]>()
	const hasPlaybackIndex = !!state
	const bgColor: Color | undefined =
		isFocus && hasPlaybackIndex ? "green" : isFocus ? "blue" : undefined
	const textColor: Color | undefined =
		bgColor && hasPlaybackIndex
			? "black"
			: hasPlaybackIndex
				? "green"
				: undefined

	const titleDisplay = track.title ?? path.basename(track.id)

	const { useEvent } = useKeymap({ submit: { key: "return" } })
	useEvent("submit", onSelect)
	const icon = state === "playing" ? appConfig.icons.playingIndicator : ""

	return (
		<Box
			width="100"
			backgroundColor={bgColor}
			onClick={() => (isFocus ? onSelect() : control.goToIndex(index))}
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
