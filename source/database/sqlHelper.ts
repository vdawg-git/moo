import { getTableColumns, type SQL, sql } from "drizzle-orm"
import type { SQLiteTable, SQLiteTransaction } from "drizzle-orm/sqlite-core"
import type { DrizzleDatabase } from "./types"

/**
 * Upsert a table, updating the columns if the key already exists.
 *
 *
 * For the SQL transaction to trigger this needs to return the operation directly
 * and not a Result type
 * */
export async function upsert<
	T extends SQLiteTable,
	V extends readonly T["$inferInsert"][],
	E extends keyof T["$inferInsert"]
>(
	table: T,
	values: V,
	/** First key should be the primary key, then other unique keys */
	primaryKey: E,
	database:
		| DrizzleDatabase
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
			set: conflictUpdateAll(table)
		})
}

/** Updates all columns except primary ones */
function conflictUpdateAll<T extends SQLiteTable>(table: T) {
	const columns = Object.entries(getTableColumns(table))
	const updateColumns = columns.filter(([_, { primary }]) => !primary)

	return updateColumns.reduce((acc, [columnName, column]) => {
		//@ts-expect-error
		acc[columnName] = sql.raw(`excluded.${column.name}`)

		return acc
	}, {}) as Partial<Record<keyof typeof table.$inferInsert, SQL>>
}
