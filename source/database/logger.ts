import { logg } from "#/logs"
import type { Logger } from "drizzle-orm/logger"

/** Custom Drizzle logger which uses Winston */
export const databaseLogger: Logger = {
	logQuery(query: string, params: unknown[]): void {
		logg.debug("Database query", { query, params })
	}
}
