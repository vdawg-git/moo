import { orderBy } from "natural-orderby"
import type { TrackData } from "./types"
import { logg } from "#/logs"

/** Prefixs to remove at the start of a title for sorting purposes */
const prefixes = [
	"the",
	"a",
	"an",
	"der",
	"der",
	"die",
	"das",
	"ein",
	"eine",
	"einen",
	"einer",
	"le",
	"la",
	"les",
	"un",
	"une",
	"des",
	"Il",
	"Lo",
	"La",
	"Gli",
	"I",
	"Un",
	"Una",
	"El",
	"La",
	"Los",
	"Las",
	"Un",
	"Una",
	"De",
	"Het",
	"Een",
	"Ten",
	"Ta",
	"To"
]
const startRg = new RegExp(`^(?:${prefixes.join("|")})\\s+`, "i")

/**
 * Sorts an array of tracks naturally
 */
export function sortTracks<
	T extends Partial<TrackData> & { id: TrackData["id"] }
>(tracks: readonly T[]): readonly T[] {
	return orderBy(
		tracks,
		[
			(t) => t.titlesort ?? t.title?.replace(startRg, "") ?? t.id,
			(t) => t.artistsort ?? t.artist?.replace(startRg, ""),
			(t) => t.albumartistsort,
			(t) => t.albumsort?.replace(startRg, "") ?? t.album?.replace(startRg, "")
		],

		["asc", "asc", "asc", "asc"]
	)
}
