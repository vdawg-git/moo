import path from "node:path";
import { Box, List, Text, useKeymap, useList, useListItem } from "tuir";
import { appConfig } from "#/config/config";
import type { BaseTrack } from "../database/types";

type PlaylistProps = {
	tracks: readonly BaseTrack[];
	onChange: (index: number) => void;
	playingIndex?: number | undefined;
};

export function Tracklist({ tracks, onChange, playingIndex }: PlaylistProps) {
	const { listView, items } = useList(tracks, {
		windowSize: "fit",
		unitSize: 1,
		navigation: "vi-vertical",
		centerScroll: false,
		fallthrough: false,
	});

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
					),
				}}
			/>
		</Box>
	);
}

type TrackItemProps = {
	onSelect: () => void;
	isPlaying: boolean;
};

function TrackItem({ onSelect, isPlaying }: TrackItemProps): React.ReactNode {
	const {
		isFocus,
		item: track,
		control,
		itemIndex,
	} = useListItem<BaseTrack[]>();
	const color = isFocus ? "blue" : undefined;
	const titleDisplay = track.title ?? path.basename(track.id);

	const { useEvent } = useKeymap({ submit: { key: "return" } });
	useEvent("submit", onSelect);
	const playIcon = isPlaying ? appConfig.icons.playingIndicator : "";

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
	);
}
