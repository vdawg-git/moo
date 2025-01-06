import { Select } from "@inkjs/ui"
import type { Track } from "../database/types"

type PlaylistProps = {
	tracks: readonly Track[]
	onSelect: (index: number) => void
}

export function Playlist({ tracks, onSelect }: PlaylistProps) {
	return (
		<Select
			options={tracks.map((track, index) => ({
				label: track.title ?? track.id,
				value: index.toString(),
			}))}
			visibleOptionCount={tracks.length}
			onChange={(index) => onSelect(Number(index))}
			highlightText="Yooo >>"
		/>
	)
}
