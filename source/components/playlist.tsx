import { Select } from "@inkjs/ui"
import type { Track } from "../database/types"

type PlaylistProps = {
	// id: string
	// name: string
	tracks: readonly Track[]
	onChange: (id: string) => void
}

export function Playlist({ tracks, onChange }: PlaylistProps) {
	return (
		<Select
			options={tracks.map((track) => ({
				label: track.title ?? track.id,
				value: track.id,
			}))}
			visibleOptionCount={tracks.length}
			onChange={onChange}
			highlightText=">>"
		/>
	)
}
