import { relations, sql } from "drizzle-orm"
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { ILyricsTag } from "music-metadata"
import type { FilePath } from "#/types/types"
import type { AlbumId, ArtistId, PlaylistId, TrackId } from "./types"

export type TrackColumnKey = keyof (typeof tableTracks)["_"]["columns"]
export type TrackColumn = (typeof tableTracks)["_"]["columns"][TrackColumnKey]
/** File metadata used to detect wether the local track was modified. */
export type TrackFileMeta = Pick<
	typeof tableTracks.$inferSelect,
	"mtime" | "size"
>

// Currently based on https://orm.drizzle.team/docs/drizzle-kit-migrate
// and https://bun.sh/docs/bundler/executables#embed-assets-files
// there doesn't seem to an easy way to handle migrations automatically.
// But as the database currently only acts as a cache, we can safely recreate it if the version doesnt match
//! Increase this if you change the schema in a breaking way.
export const DATABASE_VERSION = 1
export const versionTable = sqliteTable("version", {
	version: integer()
		.notNull()
		.unique()
		.primaryKey()
		.$default(() => DATABASE_VERSION)
})

export const tableTracks = sqliteTable("tracks", {
	id: text().primaryKey().$type<TrackId>(),

	/** What provides this track. Currently we only have `local` for local files.  */
	sourceProvider: text().notNull(),

	/** In milliseconds */
	duration: integer().notNull(),

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
	artist: text().references(() => tableArtists.name, { onDelete: "cascade" }),
	/** Track album artists */
	albumartist: text().references(() => tableArtists.name, {
		onDelete: "cascade"
	}),
	/** Album title */
	album: text().references(() => tableAlbums.id, { onDelete: "cascade" }),
	comment: text(),
	genre: text(),
	/** Filepath to the artwork */
	picture: text().$type<FilePath>(),
	/** Track composer */
	composer: text(),
	/** Synchronized lyrics */
	lyrics: text({ mode: "json" }).$type<readonly ILyricsTag[]>(),
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
	catalognumber: text(),
	podcast: integer({ mode: "boolean" }),
	podcasturl: text(),
	releasestatus: text(),
	releasetype: text(),
	releasecountry: text(),
	script: text(),
	language: text(),
	releasedate: integer({ mode: "timestamp" }),
	performerInstrument: text(),

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
	keywords: text(),
	/** Movement */
	movement: text(),
	/** Movement Index/Total */
	movementIndex: integer(),
	movementIndexOf: integer(),
	/** Podcast Identifier */
	podcastId: text(),

	// extra
	bitrate: integer(),
	codec: text(),
	audioMD5: text(),
	lossless: integer({ mode: "boolean" }),
	modificationTime: integer({ mode: "timestamp_ms" }),
	trackGain: integer(),
	numberOfChannels: integer(),
	numberOfSamples: integer(),
	tool: text(),
	trackPeakLevel: integer(),
	sampleRate: integer(),
	bitsPerSample: integer(),
	albumGain: integer(),
	codecProfile: text(),
	container: text(),

	// File metadata. Used to detect wether the file changed.
	size: integer().notNull(),
	mtime: integer().notNull()
})

export const relationsTrack = relations(tableTracks, ({ one }) => ({
	album: one(tableAlbums, {
		fields: [tableTracks.album, tableTracks.artist],
		references: [tableAlbums.title, tableAlbums.artist]
	}),
	artist: one(tableArtists, {
		relationName: "artist",
		fields: [tableTracks.artist],
		references: [tableArtists.name]
	}),
	albumArtist: one(tableArtists, {
		relationName: "albumArtist",
		fields: [tableTracks.albumartist],
		references: [tableArtists.name]
	})
}))

export const tableArtists = sqliteTable("artists", {
	name: text().primaryKey().$type<ArtistId>(),
	sort: text()
})
export type ArtistSimple = typeof tableArtists.$inferSelect

export const relationsArtist = relations(tableArtists, ({ many }) => ({
	tracks: many(tableTracks, { relationName: "artist" }),
	albumArtistTracks: many(tableTracks, { relationName: "albumArtist" }),
	albums: many(tableAlbums)
}))

export const tableAlbums = sqliteTable(
	"albums",
	{
		title: text("title").notNull(),
		artist: text("artist").references(() => tableArtists.name, {
			onDelete: "cascade"
		}),
		sort: text("sort"),
		id: text().primaryKey().$type<AlbumId>()
	},
	(table) => [primaryKey({ name: "id", columns: [table.title, table.artist] })]
)
export type AlbumSimple = typeof tableAlbums.$inferSelect

export const relationsAlbum = relations(tableAlbums, ({ one, many }) => ({
	tracks: many(tableTracks),
	artist: one(tableArtists, {
		fields: [tableAlbums.artist],
		references: [tableArtists.name]
	})
}))

export const tableMovements = sqliteTable("movements", {
	title: text().primaryKey()
})
export type MovementSimple = typeof tableAlbums.$inferSelect

export const tableComposers = sqliteTable("composers", {
	name: text().primaryKey(),
	sort: text()
})
export type ComposerSimple = typeof tableAlbums.$inferSelect

/**
 * Currently we only support smart-playlists. Might change, but prob not.
 * We might not need to save playlists in the database tbh
 * TODO: think about removing playlists from the db, as we just query them directly anyway and use the FS to know what available
 */
export const tablePlaylists = sqliteTable("playlists", {
	id: text().primaryKey().$type<PlaylistId>(),
	displayName: text()
})
export type PlaylistSimple = typeof tablePlaylists.$inferSelect
