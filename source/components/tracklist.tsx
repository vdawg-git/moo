import path from "node:path"
import { useCallback, useEffect, useState } from "react"
import { Box, List, Text, useKeymap, useList, useListItem } from "tuir"
import type { GeneralCommand } from "#/commands/appCommands"
import { appConfig } from "#/config/config"
import {
	registerKeybinds,
	unregisterKeybinds
} from "#/keybindManager/KeybindManager"
import type { BaseTrack } from "../database/types"

type PlaylistProps = {
	tracks: readonly BaseTrack[]
	onChange: (index: number) => void
	playingIndex?: number | undefined
}

export function Tracklist({ tracks, onChange, playingIndex }: PlaylistProps) {
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
				keybindings: [
					[{ key: "u", modifiers: ["ctrl"] }],
					[
						{ key: "g", modifiers: [] },
						{ key: "l", modifiers: [] },
						{ key: "g", modifiers: [] }
					]
				]
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
					map: (item, index) => (
						<TrackItem
							isPlaying={index === playingIndex}
							key={item.id}
							onSelect={() => onChange(index)}
						/>
					)
				}}
			/>
		</Box>
	)
}

type TrackItemProps = {
	onSelect: () => void
	isPlaying: boolean
}

function TrackItem({ onSelect, isPlaying }: TrackItemProps): React.ReactNode {
	const {
		isFocus,
		item: track,
		control,
		itemIndex
	} = useListItem<BaseTrack[]>()
	const color = isFocus ? "blue" : undefined
	const titleDisplay = track.title ?? path.basename(track.id)

	const { useEvent } = useKeymap({ submit: { key: "return" } })
	useEvent("submit", onSelect)
	const playIcon = isPlaying ? appConfig.icons.playingIndicator : ""

	return (
		<Box
			width="100"
			backgroundColor={color}
			onClick={() => (isFocus ? onSelect() : control.goToIndex(itemIndex))}
		>
			<Text color={"green"}>
				{playIcon}
				{"  "}
			</Text>

			<Text color={isPlaying ? "green" : undefined} wrap="truncate-end">
				{titleDisplay}
			</Text>
		</Box>
	)
}
