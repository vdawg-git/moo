import type { ICommonTagsResult, ILyricsTag, IPicture } from "music-metadata"

export type Database = {
	getTrack: (id: string) => Promise<Track | undefined>
	getTracks: (ids?: readonly string[] ) => Promise<readonly Track[]>
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

export interface Artist {
	/** Also the id in the database */
	name: string
	albums: readonly string[]
	tracks: readonly string[]
	id: string
}

export interface Playlist {
	/** Also the id in the database */
	name: string
	// For smart playlist it is the same, as those will just get updated on start/file change. The definition of the smart playlist is saved in the dotfiles.
	tracks: readonly string[]
	id: string
}

export interface Album {
	name: string
	cover: string
	artist: string
	tracks: readonly string[]
	/** Concat of albumartist and name */
	id: string
}

/** Adapted from {@link ICommonTagsResult} */
export interface Track {
	track?: number
	trackOf?: number
	disk?: number
	diskOf?: number
	/**
	 * Release year
	 */
	year?: number
	/**
	 * Track title
	 */
	title?: string
	/**
	 * Track, maybe several artists written in a single string.
	 */
	artist?: string
	/**
	 * Track album artists
	 */
	albumartist?: string
	/**
	 * Album title
	 */
	album?: string
	/**
	 * Release date
	 */
	releasedate?: string
	/**
	 * List of comments
	 */
	comment?: string
	/**
	 * Genre
	 */
	genre?: string
	/**
	 * Embedded album art
	 */
	picture?: IPicture[]
	/**
	 * Track composer
	 */
	composer?: string
	/**
	 * Synchronized lyrics
	 */
	lyrics?: ILyricsTag[]
	/**
	 * Album title, formatted for alphabetic ordering
	 */
	albumsort?: string
	/**
	 * Track title, formatted for alphabetic ordering
	 */
	titlesort?: string
	/**
	 * The canonical title of the work
	 */
	work?: string
	/**
	 * Track artist, formatted for alphabetic ordering
	 */
	artistsort?: string
	/**
	 * Album artist, formatted for alphabetic ordering
	 */
	albumartistsort?: string
	/**
	 * Composer, formatted for alphabetic ordering
	 */
	composersort?: string
	/**
	 * Lyricist(s)
	 */
	lyricist?: string[]
	/**
	 * Writer(s)
	 */
	writer?: string[]
	/**
	 * Conductor(s)
	 */
	conductor?: string[]
	/**
	 * Remixer(s)
	 */
	remixer?: string[]
	/**
	 * Arranger(s)
	 */
	arranger?: string[]
	/**
	 * Engineer(s)
	 */
	engineer?: string[]
	/**
	 * Publisher(s)
	 */
	publisher?: string[]
	/**
	 * Producer(s)
	 */
	producer?: string[]
	/**
	 * Mix-DJ(s)
	 */
	djmixer?: string[]
	/**
	 * Mixed by
	 */
	mixer?: string
	technician?: string
	label?: string
	grouping?: string
	totaltracks?: string
	totaldiscs?: string
	movementTotal?: number
	compilation?: boolean
	rating?: number
	bpm?: number
	/**
	 * Keywords to reflect the mood of the audio, e.g. 'Romantic' or 'Sad'
	 */
	mood?: string
	/**
	 * Release format, e.g. 'CD'
	 */
	media?: string
	/**
	 * Release catalog number(s)
	 */
	catalognumber?: string[]
	podcast?: boolean
	podcasturl?: string
	releasestatus?: string
	releasetype?: string[]
	releasecountry?: string
	script?: string
	language?: string
	gapless?: boolean
	isrc?: string[]
	asin?: string
	"performer:instrument"?: string[]
	averageLevel?: number
	peakLevel?: number
	originalalbum?: string
	originalartist?: string
	/**
	 * The initial key of the music in the file, e.g. "A Minor".
	 * Ref: https://docs.microsoft.com/en-us/windows/win32/wmformat/wm-initialkey
	 */
	key?: string
	/**
	 * Podcast Category
	 */
	category?: string
	/**
	 * Podcast Keywords
	 */
	keywords?: string[]
	/**
	 * Movement
	 */
	movement?: string
	/**
	 * Movement Index/Total
	 */
	movementIndex?: number
	movementIndexOf?: number
	/**
	 * Podcast Identifier
	 */
	podcastId?: string
	/**
	 * Show Movement
	 */
	showMovement?: boolean
	/**
	 * If it is a local track, the filepath
	 * Currently we only support local music
	 */
	id: string
}
