import type { ICommonTagsResult, ILyricsTag } from "music-metadata"
import type { Player } from "../player/types"
import type { Except } from "type-fest"
import type { Result } from "typescript-result"
import type { Observable } from "rxjs"

export interface Database {
	getTrack: (id: string) => Promise<Result<Track | undefined, Error>>
	getTracks: (
		ids?: readonly string[],
	) => Promise<Result<readonly Track[], Error>>

	getAlbum: (id: string) => Promise<Result<Album | undefined, Error>>
	getAlbums: (
		ids?: readonly AlbumId[],
	) => Promise<Result<readonly Album[], Error>>

	getArtist: (id: string) => Promise<Result<Artist | undefined, Error>>
	getArtists: (
		ids?: readonly string[],
	) => Promise<Result<readonly Artist[], Error>>

	getPlaylist: (id: PlaylistId) => Promise<Result<Playlist | undefined, Error>>
	getPlaylists: (
		ids: readonly PlaylistId[],
	) => Promise<Result<readonly Playlist[], Error>>

	/** Fuzzy search the database */
	search: (input: string) => Promise<
		Result<
			{
				tracks: readonly Track[]
				albums: readonly Album[]
				artists: readonly Artist[]
				playlists: readonly Playlist[]
			},
			Error
		>
	>

	addTracks: (tracks: readonly TrackData[]) => Promise<Result<void, Error>>

	/** Emits when the database changes. */
	changed$: Observable<string>
}

/**
 * Adapted from {@link ICommonTagsResult}
 *
 * A class to reduce the play/pause boilerplate.
 * */
export abstract class Track {
	/**
	 * If it is a local track, the filepath.
	 * Currently we only support local music
	 */
	readonly id: TrackId
	/** Manages the playing of the track (a local track is different than a streamed one)  */
	private readonly player: Player
	readonly status$: Player["status$"]
	readonly type: string

	constructor(
		properties: Partial<Track> & { id: string },
		player: Player,
		type: string,
	) {
		Object.assign(this, properties)
		this.id = properties.id
		this.player = player
		this.status$ = this.player.status$
		this.type = type
	}

	play() {
		this.player.play(this.id)
	}
	pause() {
		this.player.pause(this.id)
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
	readonly album?: string
	/** Release date */
	readonly releasedate?: number
	readonly comment?: string
	readonly genre?: string
	/** Filename of the cover image, like `<HASH>.jpg` */
	readonly picture?: string
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
	readonly lyricist?: readonly string[]
	/** Writer(s) */
	readonly writer?: readonly string[]
	/** Conductor(s) */
	readonly conductor?: readonly string[]
	/** Remixer(s) */
	readonly remixer?: readonly string[]
	/** Arranger(s) */
	readonly arranger?: readonly string[]
	/** Engineer(s) */
	readonly engineer?: readonly string[]
	/** Publisher(s) */
	readonly publisher?: readonly string[]
	/** Producer(s) */
	readonly producer?: readonly string[]
	/** Mix-DJ(s) */
	readonly djmixer?: readonly string[]
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
	readonly catalognumber?: readonly string[]
	readonly podcast?: boolean
	readonly podcasturl?: string
	readonly releasestatus?: string
	readonly releasetype?: readonly string[]
	readonly releasecountry?: string
	readonly script?: string
	readonly language?: string
	readonly gapless?: boolean
	readonly isrc?: readonly string[]
	readonly asin?: string
	readonly "performer:instrument"?: readonly string[]
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
	readonly keywords?: readonly string[]
	/** Movement */
	readonly movement?: string
	/** Movement Index/Total */
	readonly movementIndex?: number
	readonly movementIndexTotal?: number
	/** Podcast Identifier */
	readonly podcastId?: string
	/** Show Movement */
	readonly showMovement?: boolean
}

export type TrackData = Except<Track, "play" | "pause" | "status$">

interface Artist {
	/** Also the id in the database */
	name: string
	albums: readonly string[]
	tracks: readonly string[]
	id: string
}

interface Playlist {
	/** Also the id in the database */
	name: string
	// For smart playlist it is the same, as those will just get updated on start/file change. The definition of the smart playlist is saved in the dotfiles.
	tracks: readonly string[]
	id: string
}

interface Album {
	name: string
	cover: string
	artist: string
	tracks: readonly string[]
	/** Concat of albumartist and name */
	id: string
}

export type TrackId = string & { __brand: "TrackId" }
export type AlbumId = string & { __brand: "AlbumId" }
export type ArtistId = string & { __brand: "ArtistId" }
export type PlaylistId = string & { __brand: "PlaylistId" }
