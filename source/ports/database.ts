// Re-import for local use
import type { PlaylistBlueprint } from "#/core/playlists/schema"
import type {
	AlbumId,
	ArtistId,
	PlaylistId,
	TrackId
} from "#/shared/types/brandedIds"
import type { FilePath } from "#/shared/types/types"
import type { ILyricsTag } from "music-metadata"
import type { Observable } from "rxjs"
import type { AsyncResult, Result } from "typescript-result"

/**
 * Database port — domain types and the AppDatabase interface.
 */

export type {
	TrackId,
	AlbumId,
	ArtistId,
	PlaylistId
} from "#/shared/types/brandedIds"

export type {
	BooleanSchema,
	DateSchema,
	MetaOperator,
	NumberSchema,
	PlaylistBlueprint,
	StringSchema,
	TrackColumnSchema
} from "#/core/playlists/schema"

/** The interface for the moo SQLite database */
export type AppDatabase = Readonly<{
	getTrack: (id: TrackId) => Promise<Result<BaseTrack, Error>>
	getTracks: (
		ids?: readonly TrackId[]
	) => Promise<Result<readonly BaseTrack[], Error>>
	/**
	 * Deletes all tracks which are *not* part of the provided IDs.
	 *
	 * This is used to clean up the database after updating the tracks from the music directories.
	 * */
	deleteTracksInverted: (
		ids: readonly TrackId[]
	) => Promise<Result<void, Error>>

	getTracksFileMetadata: (
		ids?: readonly TrackId[]
	) => Promise<Result<Record<TrackId, TrackFileMeta>, Error>>

	getAlbum: (id: AlbumId) => AsyncResult<Album | undefined, Error>
	getAlbums: (
		ids?: readonly AlbumId[]
	) => AsyncResult<readonly AlbumSimple[], Error>

	getArtist: (name: ArtistId) => AsyncResult<Artist | undefined, Error>
	getArtists: (
		names?: readonly ArtistId[]
	) => AsyncResult<readonly ArtistSimple[], Error>

	getPlaylist: (id: PlaylistId) => AsyncResult<Playlist, Error>
	getPlaylists: (
		ids?: readonly PlaylistId[]
	) => AsyncResult<readonly PlaylistSimple[], Error>

	upsertSmartPlaylist: (data: {
		id: PlaylistId
		schema: PlaylistBlueprint
	}) => AsyncResult<unknown, Error>

	/**
	 * Deletes the playlist in the database,
	 * does not do any other IO.
	 *
	 * Used when a playlist file got removed from the filesystem.
	 */
	deletePlaylist: (id: PlaylistId) => AsyncResult<PlaylistId, Error>

	/** Fuzzy search the database */
	search: (input: string) => Promise<
		Result<
			{
				tracks: readonly BaseTrack[]
				albums: readonly AlbumSimple[]
				artists: readonly ArtistSimple[]
				playlists: readonly PlaylistSimple[]
			},
			Error
		>
	>

	/**
	 * Gets all moods and genres sorted by how likely they would apply to the current track.
	 * Excludes the moods/genres the track already has.
	 */
	getCoOccurenceTags: (
		trackId: TrackId
	) => AsyncResult<CoOccurenceReturn, Error>

	/**
	 * Upserts tracks.
	 *
	 * This is used to update the tracks from the music directories.
	 *
	 * Calling this will trigger {@linkcode changed$}.
	 * */
	upsertTracks: (tracks: readonly TrackData[]) => Promise<Result<void, Error>>

	/** Emits when the database changes. */
	changed$: Observable<string>
}>

/**
 * Basic track data used for listing tracks.
 *
 * Consumes a lot less memory than fetching all metadata.
 */
export type BaseTrack = Pick<
	Track,
	| "album"
	| "artist"
	| "title"
	| "duration"
	| "id"
	| "picture"
	| "genre"
	| "albumartist"
	| "mood"
>

/**
 * Track metadata. Adapted from ICommonTagsResult.
 *
 * A plain data type — playback operations live in the Player port.
 */
export type Track = {
	readonly id: TrackId
	readonly sourceProvider: string
	readonly duration: number
	readonly trackNumber?: number
	readonly trackNumberTotal?: number
	readonly disk?: number
	readonly diskOf?: number
	readonly year?: number
	readonly title?: string
	readonly artist?: string
	readonly albumartist?: string
	readonly album?: string
	readonly releasedate?: Date
	readonly comment?: string
	readonly genre?: readonly string[]
	readonly picture?: FilePath
	readonly composer?: string
	readonly lyrics?: readonly ILyricsTag[]
	readonly albumsort?: string
	readonly titlesort?: string
	readonly work?: string
	readonly artistsort?: string
	readonly albumartistsort?: string
	readonly composersort?: string
	readonly lyricist?: string
	readonly writer?: string
	readonly conductor?: string
	readonly remixer?: string
	readonly arranger?: string
	readonly engineer?: string
	readonly publisher?: string
	readonly producer?: string
	readonly djmixer?: string
	readonly mixer?: string
	readonly technician?: string
	readonly label?: string
	readonly grouping?: string
	readonly totaltracks?: string
	readonly totaldiscs?: string
	readonly movementTotal?: number
	readonly compilation?: boolean
	readonly rating?: number
	readonly bpm?: number
	readonly mood?: readonly string[]
	readonly media?: string
	readonly catalognumber?: string
	readonly podcast?: boolean
	readonly podcasturl?: string
	readonly releasestatus?: string
	readonly releasetype?: string
	readonly releasecountry?: string
	readonly script?: string
	readonly language?: string
	readonly gapless?: boolean
	readonly isrc?: string
	readonly asin?: string
	readonly performerInstrument?: string
	readonly averageLevel?: number
	readonly peakLevel?: number
	readonly originalalbum?: string
	readonly originalartist?: string
	readonly key?: string
	readonly category?: string
	readonly keywords?: string
	readonly movement?: string
	readonly movementIndex?: number
	readonly movementIndexTotal?: number
	readonly podcastId?: string
	readonly showMovement?: boolean
	readonly bitrate?: number
	readonly codec?: string
	readonly audioMD5?: string
	readonly lossless?: boolean
	readonly modificationTime?: Date
	readonly trackGain?: number
	readonly numberOfChannels?: number
	readonly numberOfSamples?: number
	readonly tool?: string
	readonly trackPeakLevel?: number
	readonly sampleRate?: number
	readonly bitsPerSample?: number
	readonly albumGain?: number
	readonly codecProfile?: string
	readonly container?: string
	readonly mtime: number
	readonly size: number
}

/** Raw track data to be fed into the database */
export type TrackData = Track

export type Artist = {
	/** Also the id in the database */
	name: string
	albums: readonly Album[]
	tracks: readonly BaseTrack[]
}

export type Playlist = {
	id: PlaylistId
	displayName?: string
	tracks: readonly BaseTrack[]
}

export type Album = {
	title: string
	artist?: string
	tracks: readonly BaseTrack[]
	/** Concat of albumartist and name */
	id: AlbumId
}

export type AlbumSimple = Readonly<{
	title: string
	artist: string | null
	sort: string | null
	id: AlbumId
}>

export type ArtistSimple = Readonly<{
	name: ArtistId
	sort: string | null
}>

export type PlaylistSimple = Readonly<{
	id: PlaylistId
	displayName: string | null
}>

/** File metadata used to detect whether the local track was modified. */
export type TrackFileMeta = Readonly<{
	mtime: number
	size: number
}>

export type CoOccurenceReturn = {
	genre: { name: string; score: number }[]
	moods: { name: string; score: number }[]
}
