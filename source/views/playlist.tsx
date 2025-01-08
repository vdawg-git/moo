import { Select } from "@inkjs/ui"
import type { Track } from "../database/types"
import { Tracklist } from "#/components/tracklist"
import { Box } from "ink"

type PlaylistProps = {
	title: string
	tracks: readonly Track[]
	onSelect: (index: number) => void
}

export function Playlist({ tracks, onSelect }: PlaylistProps) {
	// the playlist should render the correct data
	// based on what is currently set in "view"
	//
	// there are two approaches:
	// 1. the playlist is smart
	// 2. the playlist is dumb
	//
	// If it is "smart", which means that it knows what to render/fetch based
	// on the current view in the state, it could still be wrong,
	// simply because the router made a mistake, as invalid state would easily be representable

	// If it is dumb, it doesn't know shit. It just renders it's props
	// and functionallity is injected via callbacks/event handlers.
	// So if the router has to pass everything to it, it has to fetch stuff and pass it on.
	// If it fetches the wrong things, Typescript will cry as this state is not representable
	// Thus we choose a dumb component and a smart router.
	// We dont have a router yet though. Lets build one
	return (
		<Box>
			<Tracklist />
		</Box>
	)
}
