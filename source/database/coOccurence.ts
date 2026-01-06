import { sql } from "drizzle-orm"
import { tableTracks } from "./schema"
import type { CoOccurenceReturn, DrizzleDatabase, TrackId } from "./types"

export async function getCoOccurenceTags(
	trackId: TrackId,
	database: DrizzleDatabase
): Promise<CoOccurenceReturn> {
	const query = sql`WITH reference AS (
  SELECT genre,
    artist,
    album,
    mood,
    albumartist
  FROM ${tableTracks}
  WHERE ${tableTracks.id} = ${trackId}
),
genre_score AS (
  SELECT g.value as genre,
    SUM(
      CASE
        WHEN r.album = t.album THEN 10
        ELSE 0
      END + CASE
        WHEN r.artist = t.artist
        OR t.albumartist = r.albumartist
        OR t.albumartist = r.artist THEN 5
        ELSE 0
      END + (
        SELECT COUNT(*)
        FROM json_each(t.genre) tg
        WHERE tg.value IN (
            SELECT rg.value
            FROM json_each(r.genre) rg
          )
      ) * 2 + (
        SELECT COUNT(*)
        FROM json_each(t.mood) tm
        WHERE tm.value IN (
            SELECT rm.value
            FROM json_each(r.mood) rm
          )
      )
    ) as score
  FROM ${tableTracks} t
    INNER JOIN json_each(t.genre) g
    CROSS JOIN reference r
  GROUP BY g.value
  ORDER BY score
),
mood_score AS (
  SELECT m.value as mood,
    SUM(
      CASE
        WHEN t.album = r.album THEN 10
        ELSE 0
      END + CASE
        WHEN t.artist = r.artist
        OR t.albumartist = r.albumartist
        OR t.albumartist = r.artist THEN 5
        ELSE 0
      END + (
        SELECT COUNT(*)
        FROM json_each(t.genre) tg
        WHERE tg.value IN (
            SELECT rg.value
            FROM json_each(r.genre) rg
          )
      ) + (
        SELECT COUNT(*)
        FROM json_each(t.mood) tm
        WHERE tm.value IN (
            SELECT rm.value
            FROM json_each(r.mood) rm
          )
      )
    ) as score
  FROM ${tableTracks} t
    INNER JOIN json_each(t.mood) m
    CROSS JOIN reference r
  GROUP BY m.value
  ORDER BY score DESC
)
SELECT genre_score.genre as key,
  genre_score.score as score,
  'genre' as type
FROM genre_score
UNION ALL
SELECT mood_score.mood as key,
  mood_score.score as score,
  'moods' as type
FROM mood_score
ORDER BY score DESC`

	const rawData = database.all<{
		type: "genre" | "moods"
		key: string
		score: number
	}>(query)

	return rawData.reduce(
		(accumulator, { key, type, score }) => {
			accumulator[type].push({ name: key, score })

			return accumulator
		},
		{ genre: [], moods: [] } as CoOccurenceReturn
	)
}
