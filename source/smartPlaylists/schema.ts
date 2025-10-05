import parser from "any-date-parser"
import { getTableColumns } from "drizzle-orm"
import * as R from "remeda"
import { pipe } from "remeda"
import { match } from "ts-pattern"
import { z } from "zod"
import { type TrackColumnKey, tableTracks } from "#/database/schema"
import { stripIndent } from "#/helpers"

const allDateFormatsLink =
	"https://www.npmjs.com/package/any-date-parser#exhaustive-list-of-date-formats"

const columns = getTableColumns(tableTracks)
const dateRaw = z
	.string()
	.transform((input) => parser.fromString(input))
	.describe(
		`A date in various formats. For a full list of supported formats see: ${allDateFormatsLink}`
	)

const stringOrArray = orArray(z.string()).optional()
const numberOrArray = orArray(z.number()).optional()
const dateOrArray = orArray(dateRaw).optional()
/** Not actually in the data. Gets added during parsing via the default value to allow to do pattern matching */
const discriminator = <T extends string>(string: T) =>
	z.literal(string).default(string)

const stringSchema = z.object({
	includes: stringOrArray,
	includes_not: stringOrArray,
	starts_with: stringOrArray,
	starts_not_with: stringOrArray,
	ends_with: stringOrArray,
	ends_not_with: stringOrArray,
	is: stringOrArray.describe(
		"If it is a list at least one has to match exactly."
	),
	is_not: stringOrArray.describe("If it is a list none should match exactly."),
	_type: discriminator("string")
})
export type StringSchema = z.infer<typeof stringSchema>

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
		.describe("Is in between the provided range(s), including the end."),
	_type: discriminator("number")
})
export type NumberSchema = z.infer<typeof numberSchema>

const booleanSchema = z
	.object({
		is: z.boolean(),
		_type: z.literal("boolean").default("boolean")
	})
	.describe("A very simple true/false check.")
export type BooleanSchema = z.infer<typeof booleanSchema>

/** Does not need _type as its not a rule, but just a nicer way to get a number for a rule  */
const durationSchema = z
	.object({
		minutes: z.number().optional(),
		hours: z.number().optional(),
		days: z.number().optional(),
		weeks: z.number().optional(),
		years: z.number().optional()
	})
	.strict()
	.transform((input) => {
		const { days, weeks, years, minutes, hours } = input

		const offsetMinutes =
			(minutes ?? 0) +
			(hours ?? 0) * 60 +
			(days ?? 0) * 60 * 24 +
			(weeks ?? 0) * 60 * 24 * 7 +
			(years ?? 0) * 60 * 24 * 7 * 364

		const offsetMillicseconds = offsetMinutes * 60 * 1000

		return offsetMillicseconds
	})
export type RelativeTimeSchema = z.infer<typeof durationSchema>

const dateSchema = z
	.object({
		is: dateOrArray,
		is_not: dateOrArray,
		before: dateRaw.optional(),
		after: dateRaw.optional(),
		in_the_last: durationSchema.optional(),
		not_in_the_last: durationSchema.optional(),
		_type: discriminator("date")
	})
	.describe(
		`Filter by using dates. Valid dates can be in various formats. See here for the full list of formats: ${allDateFormatsLink}`
	)
export type DateSchema = z.infer<typeof dateSchema>

/** The schema to validate all fields like 'artist', 'title' etc */
const trackColumnSchema = pipe(
	R.entries(columns),
	R.filter(([column]) => column !== "id"),
	R.map(([columnName, { columnType }]) => [columnName, columnType] as const),
	R.map(([columnName, columnType]) =>
		match(columnType)
			.with("SQLiteBoolean", () => [columnName, booleanSchema] as const)
			.with("SQLiteInteger", () => [columnName, numberSchema] as const)
			.with("SQLiteText", () => [columnName, stringSchema] as const)
			.with("SQLiteTimestamp", () => [columnName, dateSchema] as const)
			.with("SQLiteTextJson", () => undefined)
			.exhaustive()
	),
	R.filter(R.isNonNullish),
	R.map(([column, schema]) =>
		z.object({ [column]: schema }).transform((parsed) => {
			const [trackColumn, rules] = Object.entries(parsed)[0]!
			return {
				_type: "column" as const,
				column: trackColumn as TrackColumnKey,
				rules
			}
		})
	),
	(schemas) => z.union(schemas)
)

/**
 * A rule for a single property of a track.
 * For example for "Genre" with properties like "includes"
 */
export type TrackColumnSchema = z.infer<typeof trackColumnSchema>
/**
 * Defines a group of rules. Can be nested.
 */
export type MetaOperator = Readonly<{
	_type: "all" | "any"
	fields: readonly (TrackColumnSchema | MetaOperator)[]
}>

const metaOperators = [
	{
		type: "all",
		description: "*All* specified rules need to match for a track to be added."
	},
	{
		type: "any",
		description:
			"*Any* of the specified rules need to match for a track to be added. If one is passes the track gets added."
	}
] as const

const metaOperatorSchema: z.ZodType<MetaOperator> = pipe(
	metaOperators,
	R.map(({ type, description }) =>
		z
			.object({
				[type]: z.array(
					z.union([trackColumnSchema, z.lazy(() => metaOperatorSchema)])
				)
			})
			.describe(description)
			.transform((object) => {
				const [_type, fields] = Object.entries(object)[0]!
				const typedType = _type as (typeof metaOperators)[number]["type"]

				return {
					_type: typedType,
					fields
				}
			})
	),
	(metas) =>
		z
			.union(metas)
			.describe("Filter by fields or add nested 'all' and 'any' groups.")
)

/** The schema for a smart playlist config */
export const playlistBlueprintSchema = z.object({
	$schema: z
		.string()
		.optional()
		.describe(
			"The JSON schema to reference. This allows your Editor/LSP to give you autocompletion and validate some inputs."
		),
	/** Display name of the playlist */
	name: z
		.string()
		.optional()
		.describe(
			"Optional display name. If not set the filename will get shown in the app."
		),

	rules: metaOperatorSchema
		.array()
		.nonempty("`rules` is empty and would lead to an empty playlist.")
		.readonly()
		.describe(
			stripIndent(`Dictates what to put into the smart playlist.
				All top level rules need to match for a track to get added.
				An "any" group matches if any single rule within it matches. Whereas an "all" rules matches only if all rules match.`)
		)
})

/** Parsed playlist config file (blueprint) */
export type PlaylistBlueprint = z.infer<typeof playlistBlueprintSchema>

function orArray<T extends z.ZodTypeAny>(
	type: T
): z.ZodUnion<[T, z.ZodArray<T>]> {
	return type.or(z.array(type).nonempty())
}

// TODO support PLAYLIST field to include/exclude playlists from other playlists
// this is useful if you for example want to filter all skits, podcasts etc
// and then base your other playlists on that.
// Also allow for a "hidden" field in the yml to not show those meta playlists in the app
