import { tracksTable } from "#/database/schema"
import { getTableColumns } from "drizzle-orm"
import * as R from "remeda"
import { pipe } from "remeda"
import { match } from "ts-pattern"
import { z } from "zod"

const columns = getTableColumns(tracksTable)

const stringOrArray = orArray(z.string()).optional()
const numberOrArray = orArray(z.number()).optional()
const dateOrArray = orArray(z.date()).optional()

const stringSchema = z.object({
	includes: stringOrArray,
	includes_not: stringOrArray,
	starts_with: stringOrArray,
	starts_not_with: stringOrArray,
	ends_with: stringOrArray,
	ends_not_with: stringOrArray,
	is: stringOrArray
})

const numberSchema = z.object({
	is: numberOrArray.describe(
		"Is exactly the provided number. Or one of them if multiple are specified."
	),
	is_not: numberOrArray.describe("Is not the provided number(s)"),
	greater_than: z
		.number()
		.optional()
		.describe("Everything greater than the provided number."),
	smaller_than: z
		.number()
		.optional()
		.describe("Everything smaller than the provided number"),
	in_the_range: orArray(z.tuple([z.number(), z.number()]))
		.optional()
		.describe("Is in between the provided range(s), including the end.")
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
	is: dateOrArray,
	is_not: dateOrArray,
	before: z.date().optional(),
	after: z.date().optional(),
	in_the_last: relativeDateSchema.optional(),
	not_in_the_last: relativeDateSchema.optional()
})

/** The schema to validate all fields like 'artist', 'title' etc */
const fieldSchema = pipe(
	Object.entries(columns),
	R.map(([field, { columnType }]) => [field, columnType] as const),
	R.flatMap(([field, column]) =>
		match(column)
			.with("SQLiteBoolean", () => z.object({ [field]: booleanSchema }))
			.with("SQLiteInteger", () => z.object({ [field]: numberSchema }))
			.with("SQLiteText", () => z.object({ [field]: stringSchema }))
			.with("SQLiteTimestamp", () => z.object({ [field]: dateSchema }))
			.with("SQLiteTextJson", () => [])
			.exhaustive()
	),
	(schemas) => z.union([schemas[0], schemas[1], ...schemas.slice(2)])
)

type MetaOperator = Readonly<
	| { all: readonly (z.infer<typeof fieldSchema> | MetaOperator)[] }
	| { any: readonly (z.infer<typeof fieldSchema> | MetaOperator)[] }
>

const metaOperators = ["all", "any"] as const
// @ts-expect-error Too much for TS, but its fine
const metaOperatorSchema: z.ZodType<MetaOperator> = pipe(
	metaOperators,
	R.map((meta) =>
		z.object({
			[meta]: z.array(
				fieldSchema,
				z.lazy(() => metaOperatorSchema)
			)
		})
	),
	(metas) =>
		z
			.union(metas)
			.describe("Filter by fields or add nested 'all' and 'any' groups.")
)

// TODO recursive operators

/** The schema for a smart playlist config */
const playlistSchema = z.object({
	$schema: z
		.string()
		.optional()
		.describe(
			"The JSON schema to use. This allows your Editor/LSP to give you autocompletion and validate some inputs."
		),
	name: z
		.string()
		.optional()
		.describe(
			"Optional display name. If not set the filename will get shown in the app."
		),

	rules: metaOperatorSchema
		.array()
		.nonempty()
		.readonly()
		.describe("Dicates what to put into the smart playlist.")
})

function orArray<T extends z.ZodTypeAny>(
	type: T
): z.ZodUnion<[T, z.ZodArray<T, "atleastone">]> {
	return type.or(z.array(type).nonempty())
}

// TODO support PLAYLIST field to include/exclude playlists from other playlists
// this is useful if you for example want to filter all skits, podcasts etc
// and then base your other playlists on that.
// Also allow for a "hidden" field in the yml to not show those meta playlists in the app
