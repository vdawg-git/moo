import { tracksTable } from "#/database/schema"
import { getTableColumns } from "drizzle-orm"
import { mapValues, pickBy, pipe } from "remeda"
import { match } from "ts-pattern"
import { z } from "zod"

const columns = getTableColumns(tracksTable)

const stringSchema = z.object({
	includes: z.string().or(z.array(z.string()).nonempty()).optional(),
	includes_not: z.string().or(z.array(z.string()).nonempty()).optional(),
	starts_with: z.string().or(z.array(z.string()).nonempty()).optional(),
	starts_not_with: z.string().or(z.array(z.string()).nonempty()).optional(),
	ends_with: z.string().or(z.array(z.string()).nonempty()).optional(),
	ends_not_with: z.string().or(z.array(z.string()).nonempty()).optional(),
	is: z.string().or(z.array(z.string()).nonempty()).optional()
})

const numberSchema = z.object({
	is: z.number().or(z.array(z.number()).nonempty()).optional(),
	is_not: z.number().or(z.array(z.number()).nonempty()).optional(),
	greater_than: z.number().optional(),
	smaller_than: z.number().optional(),
	in_the_range: z
		.tuple([z.number(), z.number()])
		.or(z.array(z.tuple([z.number(), z.number()])).nonempty())
		.optional()
})

const booleanSchema = z.object({
	is: z.boolean()
})

const relativeDateSchema = z.object({
	days: z.number().optional(),
	weeks: z.number().optional(),
	years: z.number().optional()
})

const dateSchema = z.object({
	is: z.date().or(z.array(z.date()).nonempty()).optional(),
	is_not: z.date().or(z.array(z.date()).nonempty()).optional(),
	before: z.date().optional(),
	after: z.date().optional(),
	in_the_last: relativeDateSchema.optional(),
	not_in_the_last: relativeDateSchema.optional()
})

/** The schema to validate all fields like 'artist', 'title' etc */
const fieldsSchema = pipe(
	columns,
	pickBy((column) => column.columnType !== "SQLiteTextJson"),
	mapValues((column) =>
		match(column.columnType)
			.with("SQLiteBoolean", () => booleanSchema)
			.with("SQLiteInteger", () => numberSchema)
			.with("SQLiteText", () => stringSchema)
			.with("SQLiteTimestamp", () => dateSchema)
			.exhaustive()
	),
	z.object
)

const operators = ["ALL", "ANY", "NONE"] as const
const operatorSchema = z.record(z.enum(operators), z.string())

const playlistSchema = z.object({})
