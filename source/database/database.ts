import { eq, inArray, notInArray, or } from "drizzle-orm"
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite"
import * as R from "remeda"
import { Subject } from "rxjs"
import { Result } from "typescript-result"
import { databasePath } from "#/constants.js"
import { nullsToUndefined } from "#/helpers.js"
import { logg } from "#/logs.js"
import { schmemaToSql } from "#/smartPlaylists/toSql.js"
// @ts-expect-error
import setupSqlRaw from "../../drizzle/0000_fluffy_human_torch.sql" with {
	type: "text"
}
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
	type BaseTrack,
	type Database,
	type Playlist,
	type PlaylistId,
	Track,
	type TrackId
} from "./types.js"
import { databaseLogger } from "./logger.js"

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
						album: tracksTable.album,
						artist: tracksTable.artist,
						duration: tracksTable.duration,
						id: tracksTable.id,
						title: tracksTable.title
					} satisfies Record<keyof BaseTrack, unknown>)
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
			).map(R.map(nullsToUndefined)),

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
						.filter(R.isNonNullish)
						.map(nullsToUndefined)
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
	const shouldWork = await db
		.select({ id: tracksTable.id })
		.from(tracksTable)
		.limit(1)
		.then(() => true)
		.catch(() => false)

	if (shouldWork) return

	logg.debug("running database init..")

	const setupCalls = (setupSqlRaw as string).split("--> statement-breakpoint")

	return db.transaction((tx) => {
		setupCalls.forEach((setup) => tx.run(setup))
	})
}
