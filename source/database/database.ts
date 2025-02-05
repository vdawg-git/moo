import { type SQL, eq, getTableColumns, inArray, or, sql } from "drizzle-orm"
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite"
import type { SQLiteTable, SQLiteTransaction } from "drizzle-orm/sqlite-core"
import { isNonNullish } from "remeda"
import { Subject, noop } from "rxjs"
import { Result } from "typescript-result"
import { databasePath } from "#/constants.js"
import { nullsToUndefined } from "#/helpers.js"
import { logg } from "#/logs.js"
import { schmemaToSql } from "#/smartPlaylists/toSql.js"
import { createLocalPlayer } from "../player/player.js"
import {
	albumsTable,
	artistsTable,
	composersTable,
	movementsTable,
	playlistTracksTable,
	playlistsTable,
	tracksTable
} from "./schema.js"
import { upsert } from "./sqlHelper.js"
import {
	type AlbumId,
	type ArtistId,
	type Database,
	type Playlist,
	type PlaylistId,
	Track,
	type TrackId
} from "./types.js"

export const database = connectDatabase()

function connectDatabase(): Database {
	const db = drizzle({ connection: databasePath })
	const changed$ = new Subject<string>()

	// A lot of the api is not needed yet,
	// so they are just placeholders for now
	const database: Database = {
		getAlbum: async () => Result.ok(undefined),
		getAlbums: async (ids = []) => Result.ok([]),

		getArtist: async () => Result.ok(undefined),
		getArtists: async () => Result.ok([]),

		getTrack: async () => Result.ok(undefined),
		getTracks: async (ids = []) =>
			Result.fromAsyncCatching(
				db
					.select()
					.from(tracksTable)
					.orderBy(
						tracksTable.titlesort,
						tracksTable.title,
						tracksTable.artistsort,
						tracksTable.artist,
						tracksTable.albumartistsort,
						tracksTable.albumartist,
						tracksTable.albumsort,
						tracksTable.album
					)
					.where(
						ids.length > 0
							? inArray(tracksTable.id, ids as TrackId[])
							: undefined
					)
			).map((data) =>
				data.map((track) => new LocalTrack(nullsToUndefined(track)))
			),

		getPlaylist: async (id) => {
			return Result.fromAsyncCatching(
				db
					.select()
					.from(playlistsTable)
					.leftJoin(
						playlistTracksTable,
						eq(playlistsTable.id, playlistTracksTable.playlistId)
					)
					.leftJoin(
						tracksTable,
						eq(playlistTracksTable.trackId, tracksTable.id)
					)
					.where(eq(playlistsTable.id, id))
			).map((joined) => {
				const playlist = joined[0]?.playlists
				if (!playlist) {
					return Result.error(new Error(`Could not find playlist ${id}`))
				}

				return {
					id: playlist.id as PlaylistId,
					displayName: playlist.displayName ?? undefined,
					tracks: joined
						.map((data) => data.tracks)
						.filter(isNonNullish)
						.map((track) => new LocalTrack(nullsToUndefined(track)))
				} satisfies Playlist
			})
		},
		getPlaylists: async (ids) => {
			return Result.fromAsyncCatching(
				db
					.select()
					.from(playlistsTable)
					.where(ids && or(...ids.map((id) => eq(playlistsTable.id, id))))
			)
		},

		upsertSmartPlaylist: async (data) => {
			const result = await upsertSmartPlaylist(db)(data)
			result.onSuccess(() => changed$.next(""))

			return result
		},

		search: async () =>
			Result.ok({
				tracks: [],
				albums: [],
				artists: [],
				playlists: []
			}),

		addTracks: async (tracks) => {
			const result = await addTracks(db)(tracks)
			result.onSuccess(() => {
				changed$.next("")
			})

			return result
		},

		changed$
	}

	return database
}

const localPlayer = createLocalPlayer()

export class LocalTrack extends Track {
	constructor(properties: Partial<LocalTrack> & { id: string }) {
		super(properties, localPlayer, "local")
	}
}

const addTracks: (database: BunSQLiteDatabase) => Database["addTracks"] = (
	db
) => {
	return async (tracks) => {
		if (tracks.length === 0) {
			return Result.ok()
		}

		const movements: (typeof movementsTable.$inferInsert)[] = tracks
			.flatMap((track) => track.movement ?? [])
			.map((title) => ({ title }))

		const artists: (typeof artistsTable.$inferInsert)[] = tracks.flatMap(
			(track) =>
				track.artist
					? { name: track.artist as ArtistId, sort: track.artistsort }
					: []
		)

		const albumArtists: (typeof artistsTable.$inferInsert)[] = tracks.flatMap(
			(track) =>
				track.albumartist
					? {
							name: track.albumartist as ArtistId,
							sort: track.albumartistsort
						}
					: []
		)
		const artistsToAdd = mergeDepuplicate([...artists, ...albumArtists], "name")

		const albums: (typeof albumsTable.$inferInsert)[] = tracks.flatMap(
			(track) =>
				track.album
					? {
							title: track.album as AlbumId,
							sort: track.albumsort,
							// id reference problem. See in schema.ts
							id: "" as AlbumId
						}
					: []
		)

		const composer: (typeof composersTable.$inferInsert)[] = tracks.flatMap(
			(track) =>
				track.composer ? { name: track.composer, sort: track.composersort } : []
		)

		return Result.fromAsyncCatching(
			db.transaction(
				async (tx) => {
					if (artistsToAdd.length > 0) {
						await upsert(artistsTable, artistsToAdd, "name", tx)
					}

					if (movements.length > 0) {
						await upsert(movementsTable, movements, "title", tx)
					}

					if (albums.length > 0) {
						await upsert(albumsTable, albums, "id", tx)
					}

					if (composer.length > 0) {
						await upsert(composersTable, composer, "name", tx)
					}

					if (tracks.length > 0) {
						await upsert(tracksTable, tracks, "id", tx)
					}
				},
				{ behavior: "immediate" }
			)
		)
	}
}

const upsertSmartPlaylist: (
	database: BunSQLiteDatabase
) => Database["upsertSmartPlaylist"] = (db) => {
	return async ({ id, schema }) => {
		const sqlGetTracks = schmemaToSql(schema)

		return Result.fromAsyncCatching(
			db.transaction(async (tx) => {
				const tracks = tx.all(sqlGetTracks) as readonly { id: TrackId }[]

				await upsert(
					playlistsTable,
					[{ id, displayName: schema.name }],
					"id",
					tx
				)
				await tx
					.delete(playlistTracksTable)
					.where(eq(playlistTracksTable.playlistId, id as string))

				if (tracks.length > 0) {
					await tx.insert(playlistTracksTable).values(
						tracks.map((track, index) => ({
							playlistId: id,
							position: index,
							trackId: track.id
						}))
					)
				}
			})
		)
	}
}

/**
 * Takes an array of objects and removes all duplicates based on the provided property key.
 *
 * All properties of each key get merged together.
 * If one is undefined and one from a duplicate is not,
 * the defined one gets used.
 */
function mergeDepuplicate<T extends object, Key extends keyof T>(
	values: T[],
	/** Needs to key a value which can be used as a key itself in an object */
	key: Key
): T[] {
	const sum = {} as Record<string, unknown>

	for (const item of values) {
		const before = sum[item[key] as string] as object | undefined
		const current = Object.fromEntries(
			Object.entries(item).filter(([_, value]) => isNonNullish(value))
		)

		sum[item[key] as string] = Object.assign(before ?? {}, current)
	}

	// @ts-expect-error
	return Object.values(sum)
}
