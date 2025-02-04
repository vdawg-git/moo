import {
	type SQL,
	and,
	eq,
	gt,
	gte,
	like,
	lt,
	lte,
	not,
	notLike,
	or,
	sql
} from "drizzle-orm"
import { QueryBuilder } from "drizzle-orm/sqlite-core"
import * as R from "remeda"
import { P, match } from "ts-pattern"
import type { Simplify } from "type-fest"
import { logg } from "#/logs"
import type {
	BooleanSchema,
	DateSchema,
	MetaOperator,
	NumberSchema,
	PlaylistSchema,
	StringSchema,
	TrackColumnSchema
} from "#/smartPlaylists/schema"
import { type TrackColumn, tracksTable } from "../database/schema"

export function schmemaToSql(schema: PlaylistSchema) {
	const { rules } = schema

	const filterGroups = rules.map(transformRule)
	const builder = new QueryBuilder()
		.select({ id: tracksTable.id, sourceProvider: tracksTable.sourceProvider })
		.from(tracksTable)
		.where(and(...filterGroups))

	logg.debug("schema sql", builder.toSQL())

	return builder
}

function transformRule(rule: MetaOperator | TrackColumnSchema): SQL {
	return (
		match(rule)
			.with({ _type: P.union("all", "any") }, transfromRuleGroup)
			.with({ _type: "column" }, transformRuleColumn)
			// TODO add other playlist referencing
			.exhaustive()
	)
}

function transfromRuleGroup(groupRule: MetaOperator): SQL {
	const subqueries = groupRule.fields.map(transformRule)
	const combine = groupRule._type === "all" ? and : or
	return combine(...subqueries) ?? sql`1=1`
}

/**
 */
type ColumnFilter = (column: TrackColumn) => SQL | undefined

/**
 * Transforms a track column rule (like a rule for "album", "artist" etc) to a subquery.
 */
function transformRuleColumn(schema: TrackColumnSchema): SQL {
	const applyFilter: ColumnFilter = match(schema.rules)
		.with({ _type: "boolean" }, rulesBoolean)
		.with({ _type: "date" }, rulesDate)
		.with({ _type: "number" }, rulesNumber)
		.with({ _type: "string" }, rulesString)
		.exhaustive()

	return applyFilter(tracksTable[schema.column]) ?? sql`1=1`
}

function rulesBoolean(schema: BooleanSchema): ColumnFilter {
	return (column) => eq(column, schema.is)
}

function rulesDate(schema: DateSchema): ColumnFilter {
	return matchSubRules(schema, (type) =>
		match(type)
			.returnType<ColumnFilter>()

			.with(["after", P.select()], (after) => (column) => gt(column, after))

			.with(["before", P.select()], (before) => (column) => lt(column, before))

			.with(["in_the_last", P.select()], (durationMs) => (column) => {
				const now = Date.now()
				const offset = now - durationMs
				return and(gt(column, offset), lt(column, now))
			})

			.with(["not_in_the_last", P.select()], (durationMs) => (column) => {
				const offset = Date.now() - durationMs
				return lt(column, offset)
			})

			.with(
				["is", P.select()],
				(exact) => (column) =>
					Array.isArray(exact)
						? or(...exact.map((toCompare) => eq(column, toCompare)))
						: eq(column, exact)
			)

			.with(
				["is_not", P.select()],
				(toCompare) => (column) =>
					Array.isArray(toCompare)
						? // biome-ignore lint/style/noNonNullAssertion: The clauses should not be empty, so or should not be undefined
							and(...toCompare.map((a) => not(eq(column, a))))!
						: not(eq(column, toCompare))
			)
			.exhaustive()
	)
}

function rulesNumber(schema: NumberSchema): ColumnFilter {
	return matchSubRules(schema, (type) =>
		match(type)
			.returnType<ColumnFilter>()

			.with(
				["greater_than", P.select()],
				(toCompare) => (column) => gt(column, toCompare)
			)

			.with(
				["smaller_than", P.select()],
				(toCompare) => (column) => lt(column, toCompare)
			)

			.with(
				["in_the_range", P.select()],
				(toCompare) => (column) =>
					isSingleRange(toCompare)
						? and(gte(column, toCompare[0]), lte(column, toCompare[1]))
						: or(
								...toCompare.map(([begin, end]) =>
									and(gte(column, begin), lte(column, end))
								)
							)
			)

			.with(
				["is", P.select()],
				(toCompare) => (column) =>
					Array.isArray(toCompare)
						? or(...toCompare.map((a) => eq(column, a)))
						: eq(column, toCompare)
			)

			.with(
				["is_not", P.select()],
				(toCompare) => (column) =>
					Array.isArray(toCompare)
						? or(...toCompare.map((a) => not(eq(column, a))))
						: not(eq(column, toCompare))
			)

			.exhaustive()
	)
}

function rulesString(schema: StringSchema): ColumnFilter {
	return matchSubRules(schema, (rule) =>
		match(rule)
			.returnType<ColumnFilter>()

			.with(
				["is", P.select()],
				(toCompare) => (column) =>
					Array.isArray(toCompare)
						? or(...toCompare.map((a) => eq(column, a)))
						: eq(column, toCompare)
			)

			.with(
				["is_not", P.select()],
				(toCompare) => (column) =>
					Array.isArray(toCompare)
						? and(...toCompare.map((a) => not(eq(column, a))))
						: not(eq(column, toCompare))
			)

			.with(
				["starts_with", P.select()],
				(toCompare) => (column) =>
					Array.isArray(toCompare)
						? and(...toCompare.map((a) => like(column, `${a}%`)))
						: like(column, `${toCompare}%`)
			)

			.with(
				["starts_not_with", P.select()],
				(toCompare) => (column) =>
					Array.isArray(toCompare)
						? and(...toCompare.map((a) => notLike(column, `${a}%`)))
						: notLike(column, `${toCompare}%`)
			)

			.with(
				["ends_with", P.select()],
				(toCompare) => (column) =>
					Array.isArray(toCompare)
						? or(...toCompare.map((a) => like(column, `%${a}`)))
						: like(column, `%${toCompare}`)
			)

			.with(
				["ends_not_with", P.select()],
				(toCompare) => (column) =>
					Array.isArray(toCompare)
						? and(...toCompare.map((a) => notLike(column, `%${a}`)))
						: notLike(column, `%${toCompare}`)
			)

			.with(
				["includes", P.select()],
				(toInclude) => (column) =>
					Array.isArray(toInclude)
						? or(...toInclude.map((a) => like(column, `%${a}%`)))
						: like(column, `%${toInclude}%`)
			)

			.with(
				["includes_not", P.select()],
				(toInclude) => (column) =>
					Array.isArray(toInclude)
						? and(...toInclude.map((a) => notLike(column, `%${a}%`)))
						: notLike(column, `%${toInclude}%`)
			)

			.exhaustive()
	)
}

function matchSubRules<T extends Record<string, unknown>>(
	rules: T,
	matcher: (rule: Entry<Omit<NoInfer<T>, "_type">>) => ColumnFilter
): ColumnFilter {
	return R.pipe(
		R.entries(rules),
		R.filter(([key]) => key !== "_type"),
		//@ts-expect-error
		R.map((rule) => matcher(rule)),
		R.filter(R.isNonNullish),
		(rules) => (column) => and(...rules.map((applyRule) => applyRule(column)))
	)
}

/**  Taken from {@link R.entries } to make {@link matchSubRules} matcher typing work properly  */
type EntryForKey<T, Key extends keyof T> = Key extends number | string
	? [key: `${Key}`, value: Required<T>[Key]]
	: never
type Entry<T> = Simplify<
	{
		[P in keyof T]-?: EntryForKey<T, P>
	}[keyof T]
>

function isSingleRange(
	rangeOrRanges: [number, number] | [number, number][]
): rangeOrRanges is [number, number] {
	return typeof rangeOrRanges[0] === "number"
}
