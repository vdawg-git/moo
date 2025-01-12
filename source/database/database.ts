import { createLocalPlayer } from "../player/player.js"
import { Track, type Database, type TrackData } from "./types.js"
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import { databasePath } from "#/constants.js"
import { Result } from "typescript-result"
import { Subject, type Observable } from "rxjs"
import { movementsTable } from "./schema.js"

export const database = connectDatabase()

function connectDatabase(): Database {
	const db = drizzle({ connection: databasePath })
	const changed$ = new Subject<string>()

	const database: Database = {
		getAlbum: async () => Result.ok(undefined),
		getAlbums: async (ids = []) => Result.ok([]),

		getArtist: async () => Result.ok(undefined),
		getArtists: async () => Result.ok([]),

		getTrack: async () => Result.ok(undefined),
		getTracks: async (ids = []) => Result.ok(mockData()),

		getPlaylist: async () => Result.ok(undefined),
		getPlaylists: async () => Result.ok([]),

		search: async () =>
			Result.ok({
				tracks: [],
				albums: [],
				artists: [],
				playlists: [],
			}),

		addTracks: addTracks,

		changed$,
	}

	return database
}

const localPlayer = createLocalPlayer()

export class LocalTrack extends Track {
	constructor(properties: Partial<LocalTrack> & { id: string }) {
		super(properties, localPlayer, "local")
	}
}

function mockData(): readonly LocalTrack[] {
	return [
		{ id: "1", title: "Test", artist: "Test" },
		{
			id: "2",
			title: "Test 2",
			artist: "Test 2",
			duration: 600,
		},
		{
			id: "3",
			title: "Bohemian Rhapsody",
			artist: "Queen",
			duration: 600,
		},
		{
			id: "4",
			title: "Stairway to Heaven",
			artist: "Led Zeppelin",
			duration: 600,
		},
		{
			id: "5",
			title: "Hotel California",
			artist: "Eagles",
			duration: 600,
		},
		{
			id: "6",
			title: "Sweet Child O' Mine",
			artist: "Guns N' Roses",
			duration: 600,
		},
		{
			id: "7",
			title: "Imagine",
			artist: "John Lennon",
			duration: 600,
		},
	].map((data) => new LocalTrack(data))
}

const addTracks: (
	database: BunSQLiteDatabase,
	change$: Observable<string>,
) => Database["addTracks"] = (database, change$) => {
	return async (tracks) => {
		const movements = tracks.flatMap((track) => track.movement ?? [])
		const artists = tracks.flatMap((track) =>
			track.artist ? { id: track.artist, sort: track.artistsort } : [],
		)
		const albumArtists = tracks.flatMap((track) =>
			track.albumartist
				? { id: track.albumartist, sort: track.albumartistsort }
				: [],
		)
		const composer = tracks.flatMap((track) =>
			track.composer ? { id: track.composer, sort: track.composersort } : [],
		)

		// database.insert(movementsTable).values()

		return Result.ok()
		// I need to create the foreign table entries first,
		// which are `artist`, `album`, `movement`, `composer`.
		// Then I can insert the tracks.
		// But I also need to have proper upsert logic,
		// which in this case should simply update conflicting properties.
		//
		// return db.insert(tracksTable).values(tracks)
	}
}
