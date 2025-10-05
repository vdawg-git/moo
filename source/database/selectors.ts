import * as R from "remeda"
import { tableTracks } from "./schema"
import type { SQLiteColumn } from "drizzle-orm/sqlite-core"
import type { BaseTrack } from "./types"

export const selectorBaseTrack = {
	album: tableTracks.album,
	artist: tableTracks.artist,
	duration: tableTracks.duration,
	id: tableTracks.id,
	title: tableTracks.title,
	picture: tableTracks.picture,
	genre: tableTracks.genre,
	albumartist: tableTracks.albumartist
} satisfies Record<keyof BaseTrack, SQLiteColumn>

export const selectorBaseTrackForQuery = R.mapValues(
	selectorBaseTrack,
	() => true as const
)

export const selectorTrackSort = {
	titlesort: tableTracks.titlesort,
	albumsort: tableTracks.albumsort,
	albumartistsort: tableTracks.albumartistsort,
	artistsort: tableTracks.artistsort
}
