import type { SQLiteColumn } from "drizzle-orm/sqlite-core"
import { tracksTable } from "./schema"
import type { BaseTrack } from "./types"

export const baseTrackSelector = {
	album: tracksTable.album,
	artist: tracksTable.artist,
	duration: tracksTable.duration,
	id: tracksTable.id,
	title: tracksTable.title,
	picture: tracksTable.picture,
	genre: tracksTable.genre,
	albumartist: tracksTable.albumartist
} satisfies Record<keyof BaseTrack, SQLiteColumn>

export const trackSortSelector = {
	titlesort: tracksTable.titlesort,
	albumsort: tracksTable.albumsort,
	albumartistsort: tracksTable.albumartistsort,
	artistsort: tracksTable.artistsort
}
