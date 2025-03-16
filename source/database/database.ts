import { eq, inArray, notInArray, or } from "drizzle-orm"
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite"
import * as R from "remeda"
import { Subject } from "rxjs"
import { Result } from "typescript-result"
import { databasePath } from "#/constants.js"
import { nullsToUndefined } from "#/helpers.js"
import { logg, enumarateError } from "#/logs.js"
import { schmemaToSql } from "#/smartPlaylists/toSql.js"
// @ts-expect-error
import setupSqlRaw from "../../drizzle/setup.sql" with { type: "text" }
import { createLocalPlayer } from "../player/player.js"
import {
	DATABASE_VERSION,
	albumsTable,
	artistsTable,
	composersTable,
	movementsTable,
	playlistTracksTable,
	playlistsTable,
	tracksTable,
	versionTable,
	type TrackFileMeta
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
import { databaseLogger } from "./logger.js"
import { sortTracks } from "./naturalSorting.js"
import { baseTrackSelector, trackSortSelector } from "./selectors.js"

export const database = connectDatabase()

function connectDatabaseProxied(db: BunSQLiteDatabase): Database {
	const changed$ = new Subject<string>()

	// A lot of the api is not needed yet,
	// so they are just placeholders for now
	return {
		getAlbum: async () => Result.ok(undefined),
		getAlbums: async (ids = []) => Result.ok([]),
		getArtist: async () => Result.ok(undefined),
		getArtists: async () => Result.ok([]),

		getTrack: async () => Result.ok(undefined),
		getTracks: async (ids = []) =>
			Result.fromAsyncCatching(
				db
					.select({
						...baseTrackSelector,
						...trackSortSelector
					})
					.from(tracksTable)
					.where(
						ids.length > 0
							? inArray(tracksTable.id, ids as TrackId[])
							: undefined
					)
			)
				.map(R.map(nullsToUndefined))
				.map(sortTracks),

		getTracksFileMetadata: async (ids) => {
			const toSelect = {
				mtime: tracksTable.mtime,
				size: tracksTable.size
			} satisfies Record<keyof TrackFileMeta, unknown>

			return Result.fromAsyncCatching(
				db
					.select({
						id: tracksTable.id,
						...toSelect
					})
					.from(tracksTable)
					.where(ids && inArray(tracksTable.id, ids as TrackId[]))
			).map(
				R.reduce(
					(accumulator, current) => {
						accumulator[current.id] ??= R.omit(current, ["id"])
						return accumulator
					},
					{} as Record<TrackId, TrackFileMeta>
				)
			)
		},

		getPlaylist: async (id) => {
			return Result.fromAsyncCatching(
				db
					.select({
						playlist: playlistsTable,
						track: baseTrackSelector
					})
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
				const playlist = joined[0]?.playlist
				if (!playlist) {
					return Result.error(new Error(`Could not find playlist ${id}`))
				}
				const tracks = R.pipe(
					joined.flatMap(({ track }) => track ?? []),
					R.map(nullsToUndefined),
					sortTracks
				)

				return {
					id: playlist.id as PlaylistId,
					displayName: playlist.displayName ?? undefined,
					tracks
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

		deletePlaylist: async (id) => {
			return Result.fromAsyncCatching(
				db.delete(playlistsTable).where(eq(playlistsTable.id, id))
			)
				.map(() => id)
				.onSuccess(() => changed$.next(""))
		},

		search: async () =>
			Result.ok({
				tracks: [],
				albums: [],
				artists: [],
				playlists: []
			}),

		upsertTracks: async (tracks) => {
			const result = await addTracks(db)(tracks)
			result.onSuccess(() => {
				changed$.next("")
			})

			return result
		},

		deleteTracksInverted: async (ids) =>
			Result.fromAsyncCatching(
				db
					.delete(tracksTable)
					.where(notInArray(tracksTable.id, ids as TrackId[]))
			),

		changed$
	} satisfies Database
}

/**
 * Proxies access to the database object,
 * so that all methods first await the initialization/migration
 * of the database
 */
function connectDatabase(): Database {
	const db = drizzle(databasePath, { logger: databaseLogger })

	const waitForInit = initDatabase(db)
	const base = connectDatabaseProxied(db)

	/**
	 * We need this as the proxy returns
	 * a new function on each get,
	 * defeating Reacts hook system
	 */

	// biome-ignore lint/complexity/noBannedTypes: We want to type "any" function
	const stableIdentityFunctions: Record<string | symbol, Function> = {}

	return new Proxy(base, {
		get: (target, prop) => {
			// @ts-expect-error
			const gotten = target[prop]

			if (typeof gotten === "function") {
				if (!stableIdentityFunctions[prop]) {
					stableIdentityFunctions[prop] = async (...args: unknown[]) => {
						return waitForInit.then(() => gotten(...args))
					}
				}

				return stableIdentityFunctions[prop]
			}

			return gotten
		}
	})
}

const localPlayer = createLocalPlayer()

export class LocalTrack extends Track {
	constructor(properties: Partial<LocalTrack> & { id: string }) {
		super(properties, localPlayer, "local")
	}
}

const addTracks: (database: BunSQLiteDatabase) => Database["upsertTracks"] = (
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
			Object.entries(item).filter(([_, value]) => R.isNonNullish(value))
		)

		sum[item[key] as string] = Object.assign(before ?? {}, current)
	}

	// @ts-expect-error
	return Object.values(sum)
}

/**
 * Can throw and shoudn't be handled,
 * as the database setup is needed for everything
 */
async function initDatabase(db: BunSQLiteDatabase): Promise<void> {
	const shouldRecreate = await db
		.select()
		.from(versionTable)
		.limit(1)
		.then((data) => {
			const isSame = data[0]?.version !== DATABASE_VERSION
			return !isSame
		})
		.catch((error) => {
			logg.error("error checking database for init", enumarateError(error))
			return true
		})

	if (!shouldRecreate) return

	logg.info("running database init..")

	const setupCalls = (setupSqlRaw as string).split("--> statement-breakpoint")

	return db.transaction(async (tx) => {
		// reset db
		db.run("PRAGMA foreign_keys = OFF;")
		const tables = db.all<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type='table';"
		)
		for (const { name } of tables) {
			db.run(`DROP TABLE IF EXISTS ${name};`)
		}

		tx.insert(versionTable).values({ version: DATABASE_VERSION })
		setupCalls.forEach((setup) => tx.run(setup))

		db.run("PRAGMA foreign_keys = ON;")
	})
}
