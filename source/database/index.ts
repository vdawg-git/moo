import type { Database, Track } from "./types.js"

const data: readonly Track[] = [
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
]
// use Drizzle later
export async function connectDatabase(): Promise<Database> {
	return database
}

const database: Database = {
	getAlbums: async () => [],
	getArtists: async () => [],
	getTracks: async (ids = []) => data,
	getAllAlbums: async () => [],
	getAllArtists: async () => [],
	getAllTracks: async () => [],
	getAlbum: async () => undefined,
	getArtist: async () => undefined,
	getTrack: async () => undefined,
	search: async () => ({ tracks: [], albums: [], artists: [], playlists: [] }),
}

export function getTracks() {
	return data
}
