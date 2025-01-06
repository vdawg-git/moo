import type { ICommonTagsResult, ILyricsTag } from "music-metadata"
import type { Player } from "../player/types"

export interface Database {
	getTrack: (id: string) => Promise<Track | undefined>
	getTracks: (ids?: readonly string[]) => Promise<readonly Track[]>
	getAlbum: (id: string) => Promise<Album | undefined>
	getAlbums: (ids?: readonly string[]) => Promise<readonly Album[]>
	getArtist: (id: string) => Promise<Artist | undefined>
	getArtists: (ids?: readonly string[]) => Promise<readonly Artist[]>
	getAllTracks: () => Promise<readonly Track[]>
	getAllArtists: () => Promise<readonly Artist[]>
	getAllAlbums: () => Promise<readonly Album[]>
	/** Fuzzy search the database */
	search: (input: string) => Promise<{
		tracks: readonly Track[]
		albums: readonly Album[]
		artists: readonly Artist[]
		playlists: readonly Playlist[]
	}>
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
	readonly id: string
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
	/** Embedded album art */
	readonly picture?: readonly TrackPicture[]
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
	readonly movementIndexOf?: number
	/** Podcast Identifier */
	readonly podcastId?: string
	/** Show Movement */
	readonly showMovement?: boolean
}

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

interface TrackPicture {
	/** The filepath of the picture */
	readonly filepath: string
	/** Picture type */
	readonly type?: string
}

export type TrackId = string & { __brand: "TrackId" }
export type AlbumId = string & { __brand: "AlbumId" }
