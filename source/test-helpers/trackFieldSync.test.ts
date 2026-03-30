import { describe, expect, it } from "bun:test"
import { getTableColumns } from "drizzle-orm"
import { match } from "ts-pattern"
import { tableTracks } from "#/adapters/sqlite/schema"
import { trackFieldTypes } from "#/core/playlists/trackFields"
import type { TrackFieldType } from "#/core/playlists/trackFields"

/**
 * Ensures trackFieldTypes (core) stays in sync with the actual Drizzle schema (adapter).
 * If this test fails, a column was added/removed/changed in schema.ts
 * and trackFields.ts needs to be updated to match.
 */
describe("trackFieldTypes sync with tableTracks", () => {
	const drizzleColumns = getTableColumns(tableTracks)

	/** Columns excluded from playlist filtering */
	const excludedColumns = new Set([
		"id",
		"sourceProvider",
		"picture",
		"albumId",
		"lyrics"
	])

	const filterableColumns = Object.entries(drizzleColumns).filter(
		([name]) => !excludedColumns.has(name)
	)

	it("should have the same filterable column names as the Drizzle schema", () => {
		const drizzleNames = new Set(filterableColumns.map(([name]) => name))
		const fieldNames = new Set(Object.keys(trackFieldTypes))

		const missingInFields = [...drizzleNames].filter(
			(name) => !fieldNames.has(name)
		)
		const extraInFields = [...fieldNames].filter(
			(name) => !drizzleNames.has(name)
		)

		expect(
			missingInFields,
			"columns in Drizzle schema but missing in trackFieldTypes"
		).toEqual([])
		expect(
			extraInFields,
			"columns in trackFieldTypes but missing in Drizzle schema"
		).toEqual([])
	})

	it("should map Drizzle column types to the correct field types", () => {
		for (const [name, column] of filterableColumns) {
			const expectedType = drizzleColumnToFieldType(column.columnType)
			const actualType = trackFieldTypes[name as keyof typeof trackFieldTypes]

			expect(actualType, `field type mismatch for column "${name}"`).toBe(
				expectedType
			)
		}
	})
})

function drizzleColumnToFieldType(columnType: string): TrackFieldType {
	return match(columnType)
		.with("SQLiteBoolean", () => "boolean" as const)
		.with("SQLiteInteger", () => "number" as const)
		.with("SQLiteNumericNumber", () => "number" as const)
		.with("SQLiteText", () => "string" as const)
		.with("SQLiteTextJson", () => "list" as const)
		.with("SQLiteTimestamp", () => "date" as const)
		.otherwise(() => {
			throw new Error(`Unknown Drizzle column type: ${columnType}`)
		})
}
