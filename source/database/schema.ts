import { sqliteTable, primaryKey, integer, text } from "drizzle-orm/sqlite-core"
import type { ILyricsTag } from "music-metadata"
import type { AlbumId, TrackId } from "./types"
import type { FilePath } from "#/types"

export const tracks = sqliteTable("tracks", {
	id: text().primaryKey().$type<TrackId>(),

	title: text(),
	/** Track number in the album. See {@link trackNumberTotal} for the total number of tracks */
	trackIndex: integer(),
	/** Total number of track in the album. See {@link trackNumber} for the current track number. */
	trackIndexOf: integer(),
	disk: integer(),
	diskOf: integer(),
	/** Release year */
	year: integer(),
	/** Track title */
	/** Track, maybe several artists written in a single string. */
	artist: text().references(() => artists.name, { onDelete: "cascade" }),
	/** Track album artists */
	albumartist: text().references(() => artists.name, { onDelete: "cascade" }),
	/** Album title */
	album: text().references(() => albums.id, { onDelete: "cascade" }),
	comment: text(),
	genre: text(),
	/** Filepath to the artwork */
	picture: text().$type<FilePath>(),
	/** Track composer */
	composer: text(),
	/** Synchronized lyrics */
	lyrics: text({ mode: "json" }).$type<ILyricsTag[]>(),
	/** Album title, formatted for alphabetic ordering */
	albumsort: text(),
	/** Track title, formatted for alphabetic ordering */
	titlesort: text(),
	/** The canonical title of the work */
	work: text(),
	/** Track artist, formatted for alphabetic ordering */
	artistsort: text(),
	/** Album artist, formatted for alphabetic ordering */
	albumartistsort: text(),
	/** Composer, formatted for alphabetic ordering */
	composersort: text(),
	/** Lyricist(s) */
	lyricist: text(),
	/** Writer(s) */
	writer: text(),
	/** Conductor(s) */
	conductor: text(),
	/** Remixer(s) */
	remixer: text(),
	/** Arranger(s) */
	arranger: text(),

	/** Engineer(s) */
	engineer: text(),

	/** Publisher(s) */
	publisher: text(),

	/** Producer(s) */
	producer: text(),

	/** Mix-DJ(s) */
	djmixer: text(),

	/** Mixed by */
	mixer: text(),
	technician: text(),
	label: text(),
	grouping: text(),
	totaltracks: text(),
	totaldiscs: text(),
	movementTotal: integer(),
	compilation: integer({ mode: "boolean" }),
	rating: integer({ mode: "number" }),
	bpm: integer(),
	/** Keywords to reflect the mood of the audio, e.g. 'Romantic' or 'Sad' */
	mood: text(),
	/** Release format, e.g. 'CD' */
	media: text(),
	/** Release catalog number(s) */
	catalognumber: text({ mode: "json" }).$type<string[]>(),
	podcast: integer({ mode: "boolean" }),
	podcasturl: text(),
	releasestatus: text(),
	releasetype: text(),
	releasecountry: text(),
	script: text(),
	language: text(),
	releasedate: integer({ mode: "timestamp" }),
	"performer:instrument": text({ mode: "json" }).$type<string[]>(),

	averageLevel: integer(),
	peakLevel: integer(),
	/**
	 * The initial key of the music in the file, e.g. "A Minor".
	 * Ref: https://docs.microsoft.com/en-us/windows/win32/wmformat/wm-initialkey
	 */
	key: text(),
	/** Podcast Category */
	category: text(),
	/** Podcast Keywords */
	keywords: text({ mode: "json" }).$type<string[]>(),
	/** Movement */
	movement: text(),
	/** Movement Index/Total */
	movementIndex: integer(),
	movementIndexOf: integer(),
	/** Podcast Identifier */
	podcastId: text(),
})

export const artists = sqliteTable("artists", {
	name: text().primaryKey(),
	sort: text(),
})

export const albums = sqliteTable(
	"albums",
	{
		title: text("title"),
		artist: text("artist"),
		sort: text("sort"),
		// added so that id can be accessed from foreign keys
		id: text().notNull().$type<AlbumId>(),
	},
	(table) => [primaryKey({ name: "id", columns: [table.title, table.artist] })],
)

export const movements = sqliteTable("movements", {
	title: text().primaryKey(),
})

export const composers = sqliteTable("composers", {
	name: text().primaryKey(),
	sort: text(),
})
