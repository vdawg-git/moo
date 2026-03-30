import { describe, expect, it } from "bun:test"
import { z } from "zod"
import { playlistBlueprintSchema } from "#/core/playlists/schema"
import type {
	PlaylistBlueprint,
	TrackColumnSchema
} from "#/core/playlists/schema"

describe("playlistBlueprintSchema", () => {
	describe("string fields", () => {
		it("parses all string operators", () => {
			const blueprint = parse({
				rules: [
					{
						title: {
							is: "OK Computer",
							is_not: "Kid A",
							includes: "Computer",
							includes_not: "Kid",
							starts_with: "OK",
							starts_not_with: "Ki",
							ends_with: "puter",
							ends_not_with: "id"
						}
					}
				]
			})

			const rule = asColumn(blueprint.rules[0]!)
			expect(rule._type, "should be a column rule").toBe("column")
			expect(rule.column, "should target title column").toBe("title")
			expect(rule.columnType, "single-value column").toBe("single")
			expect(rule.rules._type, "should be a string rule").toBe("string")
			expect(rule.rules, "should parse all string operators").toMatchObject({
				is: "OK Computer",
				is_not: "Kid A",
				includes: "Computer",
				includes_not: "Kid",
				starts_with: "OK",
				starts_not_with: "Ki",
				ends_with: "puter",
				ends_not_with: "id"
			})
		})

		it("accepts orArray for string operators", () => {
			const blueprint = parse({
				rules: [{ artist: { is: ["Radiohead", "Beatles"] } }]
			})

			expect(asColumn(blueprint.rules[0]!).rules).toMatchObject({
				is: ["Radiohead", "Beatles"]
			})
		})
	})

	describe("number fields", () => {
		it("parses basic number operators", () => {
			const blueprint = parse({
				rules: [{ year: { greater_than: 2000, smaller_than: 2020 } }]
			})

			expect(blueprint.rules[0]).toMatchObject({
				_type: "column",
				column: "year",
				columnType: "single",
				rules: {
					_type: "number",
					greater_than: 2000,
					smaller_than: 2020
				}
			})
		})

		it("parses single in_the_range tuple", () => {
			const blueprint = parse({
				rules: [{ year: { in_the_range: [2000, 2020] } }]
			})

			expect(asColumn(blueprint.rules[0]!).rules).toMatchObject({
				in_the_range: [2000, 2020]
			})
		})

		it("parses multiple in_the_range tuples", () => {
			const blueprint = parse({
				rules: [
					{
						year: {
							in_the_range: [
								[1990, 1999],
								[2010, 2019]
							]
						}
					}
				]
			})

			expect(asColumn(blueprint.rules[0]!).rules).toMatchObject({
				in_the_range: [
					[1990, 1999],
					[2010, 2019]
				]
			})
		})
	})

	describe("date fields", () => {
		it("converts days to ms", () => {
			const blueprint = parse({
				rules: [{ releasedate: { in_the_last: { days: 7 } } }]
			})

			const expectedMs = 7 * 24 * 60 * 60 * 1000
			expect(blueprint.rules[0]).toMatchObject({
				_type: "column",
				column: "releasedate",
				columnType: "single",
				rules: { _type: "date", in_the_last: expectedMs }
			})
		})

		it("combines multiple duration units", () => {
			const blueprint = parse({
				rules: [
					{
						releasedate: {
							in_the_last: { weeks: 1, days: 3, hours: 2, minutes: 30 }
						}
					}
				]
			})

			const expectedMinutes = 30 + 2 * 60 + 3 * 24 * 60 + 1 * 7 * 24 * 60
			const expectedMs = expectedMinutes * 60 * 1000

			expect(asColumn(blueprint.rules[0]!).rules).toMatchObject({
				in_the_last: expectedMs
			})
		})
	})

	describe("boolean fields", () => {
		it("parses boolean is operator", () => {
			const blueprint = parse({
				rules: [{ compilation: { is: true } }]
			})

			expect(blueprint.rules[0], "should parse boolean rule").toMatchObject({
				_type: "column",
				column: "compilation",
				columnType: "single",
				rules: { _type: "boolean", is: true }
			})
		})
	})

	describe("list (JSON array) fields", () => {
		it("parses list fields", () => {
			const genreBlueprint = parse({
				rules: [{ genre: { includes: "rock" } }]
			})

			expect(
				asColumn(genreBlueprint.rules[0]!).columnType,
				"genre should be list type"
			).toBe("list")

			const moodBlueprint = parse({
				rules: [{ mood: { is: "happy" } }]
			})

			expect(
				asColumn(moodBlueprint.rules[0]!).columnType,
				"mood should be list type"
			).toBe("list")
		})
	})

	describe("meta operators (all/any grouping)", () => {
		it("parses any group", () => {
			const blueprint = parse({
				rules: [
					{
						any: [
							{ artist: { is: "Radiohead" } },
							{ artist: { is: "Beatles" } }
						]
					}
				]
			})

			const rule = blueprint.rules[0]!
			expect(rule._type, "should parse any group").toBe("any")
			expect(rule, "any group should contain column fields").toMatchObject({
				_type: "any",
				fields: [
					{ _type: "column", column: "artist" },
					{ _type: "column", column: "artist" }
				]
			})
		})

		it("parses all group", () => {
			const blueprint = parse({
				rules: [
					{
						all: [
							{ artist: { includes: "Radio" } },
							{ year: { greater_than: 2000 } }
						]
					}
				]
			})

			expect(blueprint.rules[0]).toMatchObject({
				_type: "all",
				fields: [
					{ _type: "column", column: "artist" },
					{ _type: "column", column: "year" }
				]
			})
		})

		it("supports nested groups", () => {
			const blueprint = parse({
				rules: [
					{
						all: [
							{
								any: [
									{ artist: { is: "Radiohead" } },
									{ artist: { is: "Beatles" } }
								]
							},
							{ year: { greater_than: 2000 } }
						]
					}
				]
			})

			const allGroup = blueprint.rules[0]!
			expect(allGroup._type, "outer group should be all").toBe("all")

			const nestedAnyGroup = (allGroup as { fields: readonly unknown[] })
				.fields[0]!
			expect(
				nestedAnyGroup,
				"should support nested any inside all"
			).toMatchObject({ _type: "any" })
		})
	})

	// done-todo split into separate it() blocks — no shared setup, fully independent test cases
	describe("top-level rules", () => {
		it("accepts multiple bare rules", () => {
			const blueprint = parse({
				rules: [
					{ artist: { includes: "Radiohead" } },
					{ year: { greater_than: 2000 } }
				]
			})

			expect(blueprint.rules).toHaveLength(2)
			expect(asColumn(blueprint.rules[0]!).column).toBe("artist")
			expect(asColumn(blueprint.rules[1]!).column).toBe("year")
		})

		it("parses optional name", () => {
			const blueprint = parse({
				name: "My Playlist",
				rules: [{ artist: { is: "Radiohead" } }]
			})

			expect(blueprint.name).toBe("My Playlist")
		})

		it("rejects unknown fields", () => {
			const result = parseResult({
				rules: [{ nonexistent_field: { includes: "test" } }]
			})

			expect(result.success).toBe(false)
		})

		it("rejects empty rules", () => {
			const result = parseResult({ rules: [] })

			expect(result.success).toBe(false)
		})
	})
})

function parse(
	input: z.input<typeof playlistBlueprintSchema>
): PlaylistBlueprint {
	return playlistBlueprintSchema.parse(input)
}

function parseResult(input: z.input<typeof playlistBlueprintSchema>) {
	return playlistBlueprintSchema.safeParse(input)
}

function asColumn(rule: PlaylistBlueprint["rules"][number]): TrackColumnSchema {
	if (rule._type !== "column") throw new Error("Expected column rule")

	return rule
}
