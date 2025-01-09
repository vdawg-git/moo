import { Select } from "@inkjs/ui"
import type { Track } from "../database/types"
import { Tracklist } from "#/components/tracklist"
import { Box } from "ink"
import { database } from "#/database/database"

type PlaylistProps = {
	id: string
}

export function Playlist({ id }: PlaylistProps) {
	const response = useQuery(["playlist", id], () => database.getPlaylist(id))

	return (
		<Box>
			<Tracklist />
		</Box>
	)
}
