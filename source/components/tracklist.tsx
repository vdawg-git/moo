import { Select } from "@inkjs/ui"
import type { Track } from "../database/types"

type PlaylistProps = {
	tracks: readonly Track[]
	onChange: (index: number) => void
}

/** Renders a list of tracks */
export function Tracklist({ tracks, onChange }: PlaylistProps) {
	return (
		<Select
			options={tracks.map((track, index) => ({
				label: track.title ?? track.id,
				value: index.toString(),
			}))}
			visibleOptionCount={tracks.length}
			onChange={(index) => onChange(Number(index))}
			highlightText="Yooo >>"
		/>
	)
}
