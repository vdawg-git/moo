import { rm } from "node:fs/promises"
import { eq, inArray, notInArray, or } from "drizzle-orm"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as R from "remeda"
import { Subject } from "rxjs"
import { Result } from "typescript-result"
import { DATA_DIRECTORY, IS_DEV } from "#/constants.js"
import { nullsToUndefined } from "#/helpers.js"
import { logger } from "#/logs.js"
import { getPlaylistBlueprintFromId } from "#/smartPlaylists/parsing.js"
import { getSmartPlaylistTracks } from "#/smartPlaylists/toSql.js"
// @ts-expect-error
import setupSqlRaw from "../../drizzle/setup.sql" with { type: "text" }
import { getCoOccurenceTags } from "./coOccurence.js"
import { sortTracks } from "./naturalSorting.js"
import * as schema from "./schema.js"
import {
	DATABASE_VERSION,
	metaTable,
	tableAlbums,
	tableArtists,
	tableComposers,
	tableMovements,
	tablePlaylists,
	tableTracks
} from "./schema.js"
import {
	selectorBaseTrack,
	selectorBaseTrackForQuery,
	selectorTrackSort
} from "./selectors.js"
import { upsert } from "./sqlHelper.js"
import type { TrackFileMeta } from "./schema.js"
import type {
	AlbumId,
	AppDatabase,
	ArtistId,
	DrizzleDatabase,
	Playlist,
	TrackId
} from "./types.js"

export type CreateDatabaseDeps = {
	readonly databasePath: string
	readonly tagSeparator: string
}

export async function createDatabase({
	databasePath,
	tagSeparator
}: CreateDatabaseDeps): Promise<AppDatabase> {
	logger.info("database init", {
		databasePath: databasePath,
		dbVersion: DATABASE_VERSION,
		isDev: IS_DEV,
		dataDir: DATA_DIRECTORY
	})

	const db = await initDatabase({ databasePath, tagSeparator })

	return wrapDrizzleDatabase({ db })
}

/** Wraps a raw Drizzle instance with the AppDatabase interface */
export function wrapDrizzleDatabase({
	db
}: {
	readonly db: DrizzleDatabase
}): AppDatabase {
	const changed$ = new Subject<string>()

	// A lot of the api is not needed yet,
	// so they are just placeholders for now
	return {
		getTrack: async (id) =>
			Result.fromAsyncCatching(
				db
					.select({ ...selectorBaseTrack })
					.from(tableTracks)
					.where(eq(tableTracks.id, id))
					.limit(1)
					.then(([track]) => {
						if (!track) {
							throw new Error(`Track not found. ID: ${id}`)
						}
						return nullsToUndefined(track)
					})
			),

		getTracks: async (ids = []) =>
			Result.fromAsyncCatching(
				db
					.select({
						...selectorBaseTrack,
						...selectorTrackSort
					})
					.from(tableTracks)
					.where(
						ids.length > 0
							? inArray(tableTracks.id, ids as TrackId[])
							: undefined
					)
			)
				.map(R.map(nullsToUndefined))
				.map(sortTracks),

		getTracksFileMetadata: async (ids) => {
			const toSelect = {
				mtime: tableTracks.mtime,
				size: tableTracks.size
			} satisfies Record<keyof TrackFileMeta, unknown>

			return Result.fromAsyncCatching(
				db
					.select({
						id: tableTracks.id,
						...toSelect
					})
					.from(tableTracks)
					.where(ids && inArray(tableTracks.id, ids as TrackId[]))
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

		getPlaylist: (id) =>
			Result.try(async () => {
				const blueprint = await getPlaylistBlueprintFromId(id).getOrThrow()

				return getSmartPlaylistTracks(db, blueprint)
					.onSuccess((tracks) => {
						logger.debug("playlist get BEFORE sort", { tracks })
					})
					.map(sortTracks)
					.onSuccess((tracks) => {
						logger.debug("playlist get after sort", { tracks })
					})
					.map(
						(tracks) =>
							({
								id,
								displayName: blueprint.name ?? undefined,
								tracks
							}) satisfies Playlist
					)
			}),

		getPlaylists: (ids) =>
			Result.fromAsyncCatching(
				db
					.select()
					.from(tablePlaylists)
					.where(ids && or(...ids.map((id) => eq(tablePlaylists.id, id))))
			),

		upsertSmartPlaylist: (data) => {
			return upsertSmartPlaylist(db)(data).onSuccess(() => changed$.next(""))
		},

		deletePlaylist: (id) => {
			return Result.fromAsyncCatching(
				db.delete(tablePlaylists).where(eq(tablePlaylists.id, id))
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
					.delete(tableTracks)
					.where(notInArray(tableTracks.id, ids as TrackId[]))
			),

		getAlbum: (id: AlbumId) =>
			Result.fromAsyncCatching(
				db.query.tableAlbums.findFirst({
					where: (columns, { eq }) => eq(columns.id, id),
					with: {
						tracks: { columns: selectorBaseTrackForQuery }
					}
				})
			).map((result) => result && nullsToUndefined(result)),

		getAlbums: (ids = []) =>
			Result.fromAsyncCatching(
				db.query.tableAlbums.findMany({
					where: (columns, { inArray }) =>
						ids.length > 0 ? inArray(columns.id, ids) : undefined
				})
			),

		getArtist: (name) =>
			Result.fromAsyncCatching(
				db.query.tableArtists.findFirst({
					where: (columns, { eq }) => eq(columns.name, name),
					with: {
						albums: {
							with: { tracks: { columns: selectorBaseTrackForQuery } }
						},
						tracks: {
							columns: selectorBaseTrackForQuery
						}
					}
				})
			).map((result) => result && nullsToUndefined(result)),

		getArtists: (names = []) =>
			Result.fromAsyncCatching(
				db.query.tableArtists.findMany({
					where: (columns, { inArray }) =>
						names.length > 0 ? inArray(columns.name, names) : undefined
				})
			),

		getCoOccurenceTags: (trackId) =>
			Result.fromAsyncCatching(getCoOccurenceTags(trackId, db)),

		changed$
	} satisfies AppDatabase
}

const addTracks: (database: DrizzleDatabase) => AppDatabase["upsertTracks"] = (
	db
) => {
	return async (tracks) => {
		if (tracks.length === 0) {
			return Result.ok()
		}

		const movements: (typeof tableMovements.$inferInsert)[] = tracks
			.flatMap((track) => track.movement ?? [])
			.map((title) => ({ title }))

		const artists: (typeof tableArtists.$inferInsert)[] = tracks.flatMap(
			(track) =>
				track.artist
					? { name: track.artist as ArtistId, sort: track.artistsort }
					: []
		)

		const albumArtists: (typeof tableArtists.$inferInsert)[] = tracks.flatMap(
			(track) =>
				track.albumartist
					? {
							name: track.albumartist as ArtistId,
							sort: track.albumartistsort
						}
					: []
		)
		const artistsToAdd = mergeDepuplicate([...artists, ...albumArtists], "name")

		const albums: (typeof tableAlbums.$inferInsert)[] = tracks.flatMap(
			(track) => {
				const artist = track.albumartist || track.artist

				return track.album
					? {
							title: track.album,
							artist,
							sort: track.albumsort
						}
					: []
			}
		)

		const composer: (typeof tableComposers.$inferInsert)[] = tracks.flatMap(
			(track) =>
				track.composer ? { name: track.composer, sort: track.composersort } : []
		)

		return Result.fromAsyncCatching(
			db.transaction(
				async (tx) => {
					if (artistsToAdd.length > 0) {
						await upsert(tableArtists, artistsToAdd, "name", tx)
					}

					if (movements.length > 0) {
						await upsert(tableMovements, movements, "title", tx)
					}

					if (albums.length > 0) {
						await upsert(tableAlbums, albums, ["artist", "title"], tx)
					}

					if (composer.length > 0) {
						await upsert(tableComposers, composer, "name", tx)
					}

					if (tracks.length > 0) {
						await upsert(tableTracks, tracks, "id", tx)
					}
				},
				{ behavior: "immediate" }
			)
		)
	}
}

function upsertSmartPlaylist(
	database: DrizzleDatabase
): AppDatabase["upsertSmartPlaylist"] {
	return ({ id, schema }) =>
		Result.fromAsyncCatching(
			upsert(tablePlaylists, [{ id, displayName: schema.name }], "id", database)
		)
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
async function initDatabase({
	databasePath,
	tagSeparator
}: CreateDatabaseDeps): Promise<DrizzleDatabase> {
	const db = drizzle(databasePath, { schema })

	const shouldRecreate = await db
		.select()
		.from(metaTable)
		.limit(1)
		.then(([data]) => {
			if (!data) {
				logger.debug(
					"Did not find meta-table entry. Recreating database next.."
				)
				return true
			}

			const isSameVersion = data.version === DATABASE_VERSION
			const isSameTagsSeperator = data.tagSeperator === tagSeparator

			return !(isSameVersion && isSameTagsSeperator)
		})
		.catch((error) => {
			logger.error("error checking database for init", error)
			return true
		})

	if (!shouldRecreate) return db

	logger.info("Database changed or doesnt exists. Running database init..")

	await rm(databasePath)
	logger.info("Removed old database")

	const db2 = drizzle(databasePath, {
		schema,
		logger: {
			logQuery(query, params) {
				logger.debug("Database query", { query, params })
			}
		}
	})

	const setupCalls = (setupSqlRaw as string)
		.split("--> statement-breakpoint")
		.map((string) => string.trim())

	logger.info("running database migration")

	db.run("PRAGMA foreign_keys = OFF;")
	try {
		await db2.transaction(async (tx) => {
			for (const setupCommand of setupCalls) {
				tx.run(setupCommand)
			}

			await tx.insert(metaTable).values({
				version: DATABASE_VERSION,
				tagSeperator: tagSeparator
			})
		})
	} finally {
		db.run("PRAGMA foreign_keys = ON;")
	}

	return db2
}
