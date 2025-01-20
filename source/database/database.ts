import { createLocalPlayer } from "../player/player.js"
import {
	Track,
	type AlbumId,
	type ArtistId,
	type Database,
	type TrackId
} from "./types.js"
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import { databasePath } from "#/constants.js"
import { AsyncResult, Result } from "typescript-result"
import { Subject, type Observable } from "rxjs"
import {
	artistsTable,
	movementsTable,
	albumsTable,
	composersTable,
	tracksTable
} from "./schema.js"
import {
	getTableConfig,
	type PrimaryKey,
	type SQLiteTable,
	type SQLiteTransaction,
	type SQLiteUpdateSetSource
} from "drizzle-orm/sqlite-core"
import { getTableColumns, inArray, sql, type SQL } from "drizzle-orm"
import { isNonNullish, mapValues } from "remeda"
import type { NullToUndefined } from "#/types/utillities.js"
import { nullsToUndefined } from "#/helpers.js"

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
		getTracks: async (ids = []) =>
			Result.fromAsyncCatching(
				db
					.select()
					.from(tracksTable)
					.where(
						ids.length > 0
							? inArray(tracksTable.id, ids as TrackId[])
							: undefined
					)
			).map((data) =>
				data.map((track) => new LocalTrack(nullsToUndefined(track)))
			),

		getPlaylist: async () => Result.ok(undefined),
		getPlaylists: async () => Result.ok([]),

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
	database
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
			database.transaction(
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

/**
 * Upsert a table, updating the columns if the key already exists.
 *
 *
 * For the SQL ransaction to trigger this needs to return the operation directly
 * and not a Result type
 * */
async function upsert<
	T extends SQLiteTable,
	V extends readonly T["$inferInsert"][],
	E extends keyof T["$inferInsert"]
>(
	table: T,
	values: V,
	/** First key should be the primary key, then other unique keys */
	primaryKey: E,
	database:
		| BunSQLiteDatabase
		| SQLiteTransaction<
				"sync",
				void,
				Record<string, never>,
				Record<string, never>
		  >
): Promise<void> {
	return database
		.insert(table)
		.values(values)
		.onConflictDoUpdate({
			//@ts-expect-error
			target: table[primaryKey],
			set: conflictUpdateAllExcept(table)
		})
}

export function conflictUpdateAllExcept<T extends SQLiteTable>(table: T) {
	const columns = Object.entries(getTableColumns(table))
	const updateColumns = columns.filter(([_, { primary }]) => !primary)

	return updateColumns.reduce((acc, [columnName, column]) => {
		//@ts-expect-error
		acc[columnName] = sql.raw(`excluded.${column.name}`)

		return acc
	}, {}) as Partial<Record<keyof typeof table.$inferInsert, SQL>>
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
