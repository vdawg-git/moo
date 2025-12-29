import { and, count, eq, isNull, not } from "drizzle-orm"
import {} from "drizzle-orm/sqlite-core"
import { tableTracks } from "./schema"
import type { BaseTrack, DrizzleDatabase } from "./types"

const scoreArtist = 4
const scoreAlbum = 5
const scoreGenre = 3
const scoreMood = 2

export async function getCoOccurenceMoods(
	track: BaseTrack,
	database: DrizzleDatabase
) {
	const subqueryArtist =
		!!track.artist &&
		(await database
			.select({ mood: tableTracks.mood, score: count() })
			.from(tableTracks)
			.where(
				and(
					eq(tableTracks.artist, track.artist),
					not(eq(tableTracks.id, track.id)),
					not(isNull(tableTracks.mood))
				)
			)
			.groupBy(tableTracks.mood))

	return database.select
}
