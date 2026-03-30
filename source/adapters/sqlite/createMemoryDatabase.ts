import { drizzle } from "drizzle-orm/bun-sqlite"
import { Result } from "typescript-result"
import { wrapDrizzleDatabase } from "./database.js"
import { parseSetupSql, setupSqlRaw } from "./parseSetupSql.js"
import * as schema from "./schema.js"
import { DATABASE_VERSION, metaTable, tableTracks } from "./schema.js"
import type { AppDatabase, TrackData } from "#/ports/database"
import type { DrizzleDatabase } from "./drizzleTypes.js"

/** Creates a raw in-memory Drizzle database with schema applied */
export async function createTestDrizzleDb(options?: {
	readonly tracks?: readonly TrackData[]
}): Promise<DrizzleDatabase> {
	const db = drizzle(":memory:", { schema })

	const setupCalls = parseSetupSql(setupSqlRaw as string)
	for (const statement of setupCalls) {
		db.run(statement)
	}

	await db.insert(metaTable).values({
		version: DATABASE_VERSION,
		tagSeperator: "|"
	})

	if (options?.tracks?.length) {
		await db
			.insert(tableTracks)
			.values(options.tracks as TrackData[])
			.onConflictDoNothing()
	}

	return db
}

/** Creates an in-memory SQLite database for testing */
export async function createMemoryDatabase(options?: {
	readonly tracks?: readonly TrackData[]
}): Promise<AppDatabase> {
	const db = await createTestDrizzleDb({ tracks: options?.tracks })

	return wrapDrizzleDatabase({
		db,
		getBlueprint: () =>
			Result.fromAsync(
				Promise.resolve(
					Result.error(
						new Error("getBlueprint not provided in memory database")
					)
				)
			)
	})
}
