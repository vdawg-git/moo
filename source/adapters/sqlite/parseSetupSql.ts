// @ts-expect-error
import setupSqlRaw from "../../../drizzle/setup.sql" with { type: "text" }

/** Splits the raw Drizzle SQL setup file into individual statements */
export function parseSetupSql(raw: string): readonly string[] {
	return (raw as string)
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0)
}

export { setupSqlRaw }
