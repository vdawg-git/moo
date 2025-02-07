import { appConfig } from "#/config/config"
import path from "node:path"
import type { Track } from "../database/types"
import { Box, List, Text, useKeymap, useList, useListItem } from "tuir"

type PlaylistProps = {
	tracks: readonly Track[]
	onChange: (index: number) => void
	playingIndex?: number | undefined
}

export function Tracklist({ tracks, onChange, playingIndex }: PlaylistProps) {
	const { listView, items } = useList(tracks, {
		windowSize: "fit",
		unitSize: 1,
		navigation: "vi-vertical",
		centerScroll: false,
		fallthrough: false
	})

	return (
		<Box flexDirection="column">
			{items.length === 0 && <Text>No tracks here :(</Text>}

			<List listView={listView}>
				{items.map((item, index) => (
					<TrackItem
						isPlaying={index === playingIndex}
						key={item.id}
						onSelect={() => onChange(index)}
					/>
				))}
			</List>
		</Box>
	)
}

type TrackItemProps = {
	onSelect: () => void
	isPlaying: boolean
}

function TrackItem({ onSelect, isPlaying }: TrackItemProps): React.ReactNode {
	const { isFocus, item: track } = useListItem<Track[]>()
	const color = isFocus ? "blue" : undefined
	const titleDisplay = track.title ?? path.basename(track.id)

	const { useEvent } = useKeymap({ submit: { key: "return" } })
	useEvent("submit", onSelect)
	const playIcon = isPlaying ? appConfig.icons.playingIndicator : ""

	return (
		<Box width="100" backgroundColor={color} onClick={() => onSelect()}>
			<Text color={"green"}>
				{playIcon}
				{"  "}
			</Text>

			<Text wrap="truncate-end">{titleDisplay}</Text>
		</Box>
	)
}
