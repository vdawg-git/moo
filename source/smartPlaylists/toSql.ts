import { QueryBuilder } from "drizzle-orm/sqlite-core"
import type {
	BooleanSchema,
	DateSchema,
	TrackColumnSchema,
	MetaOperator,
	NumberSchema,
	PlaylistSchema
} from "#/smartPlaylists/schema"
import { match, P } from "ts-pattern"
import { tracksTable, type TrackColumnKey } from "../database/schema"
import {
	and,
	eq,
	exists,
	getTableColumns,
	getTableName,
	or,
	sql,
	type Query,
	type SQL,
	type Subquery,
	type WithSubquery
} from "drizzle-orm"
import { randomUUIDv7 } from "bun"
import * as R from "remeda"
import { after } from "node:test"
import { noop } from "rxjs"

function schmemaToSql(schema: PlaylistSchema): SQL {
	const { rules } = schema

	const filterGroups = rules.map(transformRule)
	const builder = new QueryBuilder()
		.select()
		.from(tracksTable)
		.where(and(...filterGroups))
		.getSQL()

	return builder
}

function transformRule(rule: MetaOperator | TrackColumnSchema): Subquery {
	return match(rule)
		.with({ _type: P.union("all", "any") }, (all) => transfromRuleGroup(all))
		.with({ _type: "column" }, (field) => transformRuleColumn(field))
		.exhaustive()
}

function transfromRuleGroup(groupRule: MetaOperator): WithSubquery {
	const subqueries = groupRule.fields.map(transformRule)
	const combine = groupRule._type === "all" ? and : or
	const combined = combine(...subqueries)

	const builder = new QueryBuilder()
	const query = builder.$with(randomUUIDv7()).as(
		builder
			.select({ exists: sql`1` })
			.from(tracksTable)
			.where(combined && exists(combined))
	)

	return query
}

/**
 */
type RuleFilter = (field: TrackColumnKey) => SQL

/**
 * Transforms a track column rule (like "album", "artist" etc) to a subquery.
 */
function transformRuleColumn(schema: TrackColumnSchema): WithSubquery {
	const applyFilter: RuleFilter = match(schema.rules)
		.with({ _type: "boolean" }, rulesBoolean)
		.with({ _type: "date" }, rulesDate)
		.with({ _type: "number" }, rulesNumber)
		.with({ _type: "string" }, rulesString)
		.exhaustive()

	const builder = new QueryBuilder()
	const query = builder.$with(randomUUIDv7()).as(
		builder
			.select({ exists: sql`1` })
			.from(tracksTable)
			.where(exists(applyFilter(schema.column)))
	)

	return query
}

function rulesBoolean(schema: BooleanSchema): RuleFilter {
	return (column) => eq(column, schema.is)
}

function rulesDate(schema: DateSchema): RuleFilter {
	const x: RuleFilter = R.entries(schema).map((type) =>
		match(type)
			.with(["after", P.select()], (after) => {
				const ruleFilter: RuleFilter = (field) => {}
				return ruleFilter
			})
			.with(["before", P.select()], (before) => {})
			.with(["in_the_last", P.select()], (inTheLast) => {})
			.with(["not_in_the_last", P.select()], (notInTheLast) => {})
			.with(["is", P.select()], (exact) => {})
			.with(["is_not", P.select()], (not) => {})
			.with(["_type", P.select()], noop)
			.exhaustive()
	)
}

function rulesNumber(schema: NumberSchema): RuleFilter {}
function rulesString(schema: StringSchema): RuleFilter {}
