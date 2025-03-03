import { orderBy } from "natural-orderby"
import type { TrackData } from "./types"

/**
 * Sorts an array of tracks naturally
 */
export function sortTracks<
	T extends Partial<TrackData> & { id: TrackData["id"] }
>(tracks: readonly T[]): readonly T[] {
	return orderBy(
		tracks,
		[
			(t) => t.titlesort ?? t.title ?? t.id,
			(t) => t.artistsort ?? t.artist,
			(t) => t.albumartistsort ?? t.albumsort,
			(t) => t.album
		],

		["asc", "asc", "asc", "asc"]
	)
}
