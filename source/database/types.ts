import { type AsyncResult, Result } from "typescript-result"
import { addErrorNotification } from "#/state/state"
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import type { ICommonTagsResult, ILyricsTag } from "music-metadata"
import type { Observable } from "rxjs"
import type { Except } from "type-fest"
import type { PlaylistBlueprint } from "#/smartPlaylists/schema"
import type { FilePath } from "#/types/types"
import type { Player } from "../player/types"
import type * as schema from "./schema"
import type {
	AlbumSimple,
	ArtistSimple,
	PlaylistSimple,
	TrackFileMeta
} from "./schema"

/**
 * The interface of the raw Drizzle instance.
 * Not the same as the `AppDatabase` interface which wraps this one.
 */
export type DrizzleDatabase = BunSQLiteDatabase<typeof schema>

/** The interface for the moo SQLite database */
export type AppDatabase = Readonly<{
	getTrack: (id: TrackId) => Promise<Result<BaseTrack | undefined, Error>>
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
	 * Upserts tracks.
	 *
	 * This is used to update and the tracks from the music directories.
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
 * Consumes a lot less memories than fetching all metadata.
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
 * Adapted from {@link ICommonTagsResult}
 *
 * A class to reduce the play/pause boilerplate.
 * A bit overengineered as we initially thought about supporting multiple audio backends, but meh
 * */
export abstract class Track {
	/**
	 * If it is a local track, the filepath.
	 * Currently we only support local music
	 */
	readonly id: TrackId
	/** Manages the playing of the track (a local track is different than a streamed one [we dont have streaming yet, and might never will])  */
	private readonly player: Player
	/** The events for the playback of this track */
	readonly events$: Player["events$"]
	readonly sourceProvider: string
	readonly duration: number

	constructor(
		properties: Partial<Track> & { id: string },
		player: Player,
		sourceProvider: string
	) {
		Object.assign(this, properties)
		this.id = properties.id
		this.player = player
		this.events$ = this.player.events$
		this.duration = properties.duration ?? 0
		this.sourceProvider = sourceProvider
		this.size = properties.size ?? 0
		this.mtime = properties.mtime ?? 0
	}

	// We wrap the player like that as it needs to know the track id anyway,
	// like that we can always control the correct player with the correct id
	// and a simpler interface

	play() {
		return Result.fromAsync(this.player.play(this.id)).onFailure((error) =>
			addErrorNotification(
				`Failed to play track ${this.title ?? this.id}`,
				error,
				"Track playback failed"
			)
		)
	}
	pause() {
		return Result.fromAsync(this.player.pause(this.id)) //
			.onFailure((error) =>
				addErrorNotification(
					`Failed to pause track ${this.title ?? this.id}`,
					error
				)
			)
	}
	clear() {
		return Result.fromAsync(this.player.clear()).onFailure((error) =>
			addErrorNotification(
				`Failed to clear old track ${this.title ?? this.id}`,
				error,
				"Failed to clear player"
			)
		)
	}

	/** Duration in seconds to seek. Can be negative */
	seek(duration: number) {
		return Result.fromAsync(this.player.seek(duration)).onFailure((error) =>
			addErrorNotification(
				`Failed to seek track ${this.id}`,
				error,
				"Seek failed"
			)
		)
	}

	/** Track number in the album. See {@link trackNumberTotal} for the total number of tracks */
	readonly trackNumber?: number
	/** Total number of track in the album. See {@link trackNumber} for the current track number. */
	readonly trackNumberTotal?: number
	readonly disk?: number
	readonly diskOf?: number
	/** Release year */
	readonly year?: number
	/** Track title */
	readonly title?: string
	/** Track, maybe several artists written in a single string. */
	readonly artist?: string
	/** Track album artists */
	readonly albumartist?: string
	/** Album title */
	readonly album?: ICommonTagsResult["album"] & {}
	/** Release date. A timestamp */
	readonly releasedate?: Date
	readonly comment?: string
	readonly genre?: string
	/** Filename of the cover image, like `<HASH>.jpg` */
	readonly picture?: FilePath
	/** Track composer */
	readonly composer?: string
	/** Synchronized lyrics */
	readonly lyrics?: readonly ILyricsTag[]
	/** Album title, formatted for alphabetic ordering */
	readonly albumsort?: string
	/** Track title, formatted for alphabetic ordering */
	readonly titlesort?: string
	/** The canonical title of the work */
	readonly work?: string
	/** Track artist, formatted for alphabetic ordering */
	readonly artistsort?: string
	/** Album artist, formatted for alphabetic ordering */
	readonly albumartistsort?: string
	/** Composer, formatted for alphabetic ordering */
	readonly composersort?: string
	/** Lyricist(s) */
	readonly lyricist?: string
	/** Writer(s) */
	readonly writer?: string
	/** Conductor(s) */
	readonly conductor?: string
	/** Remixer(s) */
	readonly remixer?: string
	/** Arranger(s) */
	readonly arranger?: string
	/** Engineer(s) */
	readonly engineer?: string
	/** Publisher(s) */
	readonly publisher?: string
	/** Producer(s) */
	readonly producer?: string
	/** Mix-DJ(s) */
	readonly djmixer?: string
	/** Mixed by */
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
	/** Keywords to reflect the mood of the audio, e.g. 'Romantic' or 'Sad' */
	readonly mood?: string
	/** Release format, e.g. 'CD' */
	readonly media?: string
	/** Release catalog number(s) */
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
	/**
	 * The initial key of the music in the file, e.g. "A Minor".
	 * Ref: https://docs.microsoft.com/en-us/windows/win32/wmformat/wm-initialkey
	 */
	readonly key?: string
	/** Podcast Category */
	readonly category?: string
	/** Podcast Keywords */
	readonly keywords?: string
	/** Movement */
	readonly movement?: string
	/** Movement Index/Total */
	readonly movementIndex?: number
	readonly movementIndexTotal?: number
	/** Podcast Identifier */
	readonly podcastId?: string
	/** Show Movement */
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
export type TrackData = Except<
	Track,
	"play" | "pause" | "events$" | "clear" | "seek"
> & {
	/** The source of the track. Currently only `local` for local music is supported. */
	sourceProvider: string
}

export type Artist = {
	/** Also the id in the database */
	name: string
	albums: readonly Album[]
	tracks: readonly BaseTrack[]
}

export type Playlist = {
	id: PlaylistId
	displayName?: string
	// For smart playlist it is the same, as those will just get updated on start/file change. The definition of the smart playlist is saved in the dotfiles.
	tracks: readonly BaseTrack[]
}

export type Album = {
	title: string
	// cover: string
	artist?: string
	tracks: readonly BaseTrack[]
	/** Concat of albumartist and name */
	id: AlbumId
}

export type TrackId = string & { __brand: "TrackId" }
export type AlbumId = string & { __brand: "AlbumId" }
export type ArtistId = string & { __brand: "ArtistId" }
/**
 * For smart playlists it is the filename.
 * Currently we only have smart playlists though.
 */
export type PlaylistId = string & { __brand: "PlaylistId" }
