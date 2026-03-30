import { describe, expect, it } from "bun:test"
import { playlistBlueprintSchema } from "#/core/playlists/schema"
import type {
	PlaylistBlueprint,
	TrackColumnSchema
} from "#/core/playlists/schema"

// todo Im not the biggest fan of all those tests. They are basically just testing object parsing and validation. Maybe we can merge some of them together and just have a few tests that test the most important things. The more tests we have the more code we have to maintain, and the more likely it is that we have bugs in our tests. We should try to find a good balance here. Maybe we can have one test for each field type (string, number, date, boolean) and then one test for meta operators and one test for top-level rules. That way we still have good coverage but less code to maintain
describe("playlistBlueprintSchema", () => {
	describe("string fields", () => {
		it("should parse includes operator", () => {
			const blueprint = parse({
				rules: [{ artist: { includes: "Radiohead" } }]
			})

			expect(blueprint.rules[0]).toMatchObject({
				_type: "column",
				column: "artist",
				columnType: "single",
				rules: { _type: "string", includes: "Radiohead" }
			})
		})

		it("should parse all string operators", () => {
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
			expect(rule.rules._type, "should be a string rule").toBe("string")
			expect(rule.rules).toMatchObject({
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

		it("should accept arrays for string operators (orArray)", () => {
			const blueprint = parse({
				rules: [{ artist: { is: ["Radiohead", "Beatles"] } }]
			})

			expect(asColumn(blueprint.rules[0]!).rules).toMatchObject({
				is: ["Radiohead", "Beatles"]
			})
		})
	})

	describe("number fields", () => {
		it("should parse number operators", () => {
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

		it("should parse in_the_range with a single range", () => {
			const blueprint = parse({
				rules: [{ year: { in_the_range: [2000, 2020] } }]
			})

			expect(asColumn(blueprint.rules[0]!).rules).toMatchObject({
				in_the_range: [2000, 2020]
			})
		})

		it("should parse in_the_range with multiple ranges", () => {
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
		it("should parse in_the_last with duration converting to milliseconds", () => {
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

		it("should combine duration units", () => {
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
		it("should parse boolean is operator", () => {
			const blueprint = parse({
				rules: [{ compilation: { is: true } }]
			})

			expect(blueprint.rules[0]).toMatchObject({
				_type: "column",
				column: "compilation",
				columnType: "single",
				rules: { _type: "boolean", is: true }
			})
		})
	})

	describe("list (JSON array) fields", () => {
		it("should mark genre as list columnType", () => {
			const blueprint = parse({
				rules: [{ genre: { includes: "rock" } }]
			})

			expect(
				asColumn(blueprint.rules[0]!).columnType,
				"genre should be list type"
			).toBe("list")
		})

		it("should mark mood as list columnType", () => {
			const blueprint = parse({
				rules: [{ mood: { is: "happy" } }]
			})

			expect(
				asColumn(blueprint.rules[0]!).columnType,
				"mood should be list type"
			).toBe("list")
		})
	})

	describe("meta operators (all/any grouping)", () => {
		it("should parse any group", () => {
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
			expect(rule._type, "should be an any group").toBe("any")
			expect(rule).toMatchObject({
				_type: "any",
				fields: [
					{ _type: "column", column: "artist" },
					{ _type: "column", column: "artist" }
				]
			})
		})

		it("should parse all group", () => {
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

		it("should parse nested groups", () => {
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
			expect(allGroup._type).toBe("all")

			const anyGroup = (allGroup as { fields: readonly unknown[] }).fields[0]!
			expect(anyGroup).toMatchObject({ _type: "any" })
		})
	})

	describe("top-level rules", () => {
		it("should accept multiple bare column rules (AND'd together)", () => {
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

		// todo merge tests together where it makes sense and when easy. Less code to maintain
		it("should parse optional name", () => {
			const blueprint = parse({
				name: "My Playlist",
				rules: [{ artist: { is: "Radiohead" } }]
			})

			expect(blueprint.name).toBe("My Playlist")
		})
	})

	describe("validation errors", () => {
		it("should reject unknown field names", () => {
			const result = parseResult({
				rules: [{ nonexistent_field: { includes: "test" } }]
			})

			expect(result.success, "should fail for unknown field").toBe(false)
		})

		it("should reject empty rules array", () => {
			const result = parseResult({ rules: [] })

			expect(result.success, "should fail for empty rules").toBe(false)
		})
	})
})

// todo the unknown type here is a hack. make it proper type-safe
function parse(input: unknown): PlaylistBlueprint {
	return playlistBlueprintSchema.parse(input)
}

// todo the unknown type here is a hack. make it proper type-safe
function parseResult(input: unknown) {
	return playlistBlueprintSchema.safeParse(input)
}

function asColumn(rule: PlaylistBlueprint["rules"][number]): TrackColumnSchema {
	if (rule._type !== "column") throw new Error("Expected column rule")

	return rule
}
