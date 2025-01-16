import type { PlaylistId } from "../database/types"
import { Tracklist } from "#/components/tracklist"
import { Box } from "tuir"
import { database } from "#/database/database"
import { useQuery } from "#/database/query"

type PlaylistProps = {
	id: PlaylistId
}

export function Playlist({ id }: PlaylistProps) {
	const response = useQuery(["playlist", id], () => database.getPlaylist(id))

	return (
		<Box>
			<Tracklist />
		</Box>
	)
}
