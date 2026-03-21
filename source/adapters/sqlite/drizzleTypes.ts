import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import type * as schema from "./schema.js"

/**
 * The interface of the raw Drizzle instance.
 * Not the same as the `AppDatabase` interface which wraps this one.
 */
export type DrizzleDatabase = BunSQLiteDatabase<typeof schema>
