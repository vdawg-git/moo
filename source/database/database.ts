import path from "node:path"
import { createLocalPlayer } from "../player/player.js"
import { Track, type Database } from "./types.js"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { DATA_DIRECTORY, databasePath, IS_DEV } from "#/constants.js"
import { albumsTable, tracksTable } from "./schema.js"
import { Result } from "typescript-result"
import { Subject } from "rxjs"

export const database = await connectDatabase()

async function connectDatabase(): Promise<Database> {
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

		addTracks: async (tracks) => {
			changed$.next("")
			return Result.ok()
			// I need to create the foreign table entries first,
			// which are `artist`, `album`, `movement`, `composer`.
			// Then I can insert the tracks.
			// But I also need to have proper upsert logic,
			// which in this case should simply update conflicting properties.
			//
			// return db.insert(tracksTable).values(tracks)
		},

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
		},
		{
			id: "3",
			title: "Bohemian Rhapsody",
			artist: "Queen",
		},
		{
			id: "4",
			title: "Stairway to Heaven",
			artist: "Led Zeppelin",
		},
		{
			id: "5",
			title: "Hotel California",
			artist: "Eagles",
		},
		{
			id: "6",
			title: "Sweet Child O' Mine",
			artist: "Guns N' Roses",
		},
		{
			id: "7",
			title: "Imagine",
			artist: "John Lennon",
		},
	].map((data) => new LocalTrack(data))
}
