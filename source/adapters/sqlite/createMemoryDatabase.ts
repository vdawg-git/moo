import { drizzle } from "drizzle-orm/bun-sqlite"
import { Result } from "typescript-result"
// @ts-expect-error
import setupSqlRaw from "../../../drizzle/setup.sql" with { type: "text" }
import { wrapDrizzleDatabase } from "./database.js"
import * as schema from "./schema.js"
import { DATABASE_VERSION, metaTable } from "./schema.js"
import type { AppDatabase } from "#/ports/database"

/** Creates an in-memory SQLite database for testing */
export async function createMemoryDatabase(): Promise<AppDatabase> {
	const db = drizzle(":memory:", { schema })

	const setupCalls = (setupSqlRaw as string)
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0)

	for (const statement of setupCalls) {
		db.run(statement)
	}

	await db.insert(metaTable).values({
		version: DATABASE_VERSION,
		tagSeperator: "|"
	})

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
