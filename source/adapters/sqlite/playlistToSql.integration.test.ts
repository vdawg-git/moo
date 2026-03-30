import { describe, expect, it } from "bun:test"
import { z } from "zod"
import { createTestDrizzleDb } from "#/adapters/sqlite/createMemoryDatabase"
import { getSmartPlaylistTracks } from "#/adapters/sqlite/playlistToSql"
import { playlistBlueprintSchema } from "#/core/playlists/schema"
import { mockTrackData } from "#/test-helpers/testHelpers"
import type { DrizzleDatabase } from "#/adapters/sqlite/drizzleTypes"
import type { PlaylistBlueprint } from "#/core/playlists/schema"

describe("getSmartPlaylistTracks", () => {
	describe("string operators", () => {
		it("should filter by includes (case-insensitive)", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { artist: "Radiohead" }),
					mockTrackData("t2", { artist: "radiohead live" }),
					mockTrackData("t3", { artist: "Beatles" })
				]
			})

			// todo this always calls parseBlueprint, just make queryTracks call it and we save ourselves some duplication
			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { includes: "radiohead" } }] })
			)

			expect(ids, "should match case-insensitively").toHaveLength(2)
			expect(ids).toContain("t1")
			expect(ids).toContain("t2")
		})

		it("should filter by is (exact, case-insensitive)", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { artist: "Radiohead" }),
					mockTrackData("t2", { artist: "radiohead" }),
					mockTrackData("t3", { artist: "Radiohead Live" })
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { is: "radiohead" } }] })
			)

			expect(ids, "exact match should not include partial").toHaveLength(2)
			expect(ids).toContain("t1")
			expect(ids).toContain("t2")
		})

		it("should filter by is_not and exclude NULL values from positive filters", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { artist: "Radiohead" }),
					mockTrackData("t2", { artist: "Beatles" }),
					mockTrackData("t3", { artist: undefined })
				]
			})

			const isNotIds = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { is_not: "radiohead" } }] })
			)
			expect(isNotIds, "should exclude Radiohead").toEqual(["t2"])

			const includesIds = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { includes: "Radio" } }] })
			)
			expect(includesIds, "NULL artist should not match includes").toEqual([
				"t1"
			])
		})

		it("should filter by starts_with", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { title: "OK Computer" }),
					mockTrackData("t2", { title: "Kid A" }),
					mockTrackData("t3", { title: "Ok not" })
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ title: { starts_with: "ok" } }] })
			)

			expect(ids).toHaveLength(2)
			expect(ids).toContain("t1")
			expect(ids).toContain("t3")
		})

		it("should filter by ends_with", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { title: "OK Computer" }),
					mockTrackData("t2", { title: "My Computer" }),
					mockTrackData("t3", { title: "Kid A" })
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ title: { ends_with: "computer" } }] })
			)

			expect(ids).toHaveLength(2)
			expect(ids).toContain("t1")
			expect(ids).toContain("t2")
		})

		it("should filter by includes_not", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { artist: "Radiohead" }),
					mockTrackData("t2", { artist: "Beatles" }),
					mockTrackData("t3", { artist: "Radio Moscow" })
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { includes_not: "radio" } }] })
			)

			expect(ids, "should exclude tracks containing 'radio'").toEqual(["t2"])
		})
	})

	describe("logical grouping", () => {
		it("should AND top-level rules", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { artist: "Radiohead", year: 1997 }),
					mockTrackData("t2", { artist: "Radiohead", year: 2003 }),
					mockTrackData("t3", { artist: "Beatles", year: 2003 })
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({
					rules: [
						{ artist: { is: "Radiohead" } },
						{ year: { greater_than: 2000 } }
					]
				})
			)

			expect(ids, "should match only when both rules pass").toEqual(["t2"])
		})

		it("should OR rules in an any group", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { artist: "Radiohead" }),
					mockTrackData("t2", { artist: "Beatles" }),
					mockTrackData("t3", { artist: "Pink Floyd" })
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({
					rules: [
						{
							any: [
								{ artist: { is: "Radiohead" } },
								{ artist: { is: "Beatles" } }
							]
						}
					]
				})
			)

			expect(ids, "should match either artist").toHaveLength(2)
			expect(ids).toContain("t1")
			expect(ids).toContain("t2")
		})

		it("should AND rules in an all group", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { artist: "Radiohead", year: 2000 }),
					mockTrackData("t2", { artist: "Radiohead", year: 1997 }),
					mockTrackData("t3", { artist: "Beatles", year: 2000 })
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({
					rules: [
						{
							all: [{ artist: { is: "Radiohead" } }, { year: { is: 2000 } }]
						}
					]
				})
			)

			expect(ids, "should match only when all sub-rules pass").toEqual(["t1"])
		})

		it("should handle nested groups (any inside all)", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { artist: "Radiohead", year: 2003 }),
					mockTrackData("t2", { artist: "Beatles", year: 2003 }),
					mockTrackData("t3", { artist: "Radiohead", year: 1997 }),
					mockTrackData("t4", { artist: "Pink Floyd", year: 2003 })
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({
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
			)

			expect(ids).toHaveLength(2)
			expect(ids).toContain("t1")
			expect(ids).toContain("t2")
		})
	})

	// done-todo merge most of those tests. Just give it more tracks and give the expect calls a proper error message
	describe("array columns (json_each)", () => {
		it("should filter array columns by includes, is, and across different fields", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", {
						genre: ["rock", "alternative"],
						mood: ["happy", "energetic"]
					}),
					mockTrackData("t2", { genre: ["pop"], mood: ["sad"] }),
					mockTrackData("t3", { genre: ["rock"], mood: ["calm"] }),
					mockTrackData("t4", {
						genre: ["alternative"],
						mood: ["happy"]
					})
				]
			})

			const genreIncludesIds = await queryTracks(
				db,
				parseBlueprint({ rules: [{ genre: { includes: "rock" } }] })
			)
			expect(
				genreIncludesIds,
				"genre includes 'rock' should match t1 and t3"
			).toHaveLength(2)
			expect(genreIncludesIds).toContain("t1")
			expect(genreIncludesIds).toContain("t3")

			const genreIsIds = await queryTracks(
				db,
				parseBlueprint({ rules: [{ genre: { is: "alternative" } }] })
			)
			expect(
				genreIsIds,
				"genre is 'alternative' should match t1 and t4"
			).toHaveLength(2)
			expect(genreIsIds).toContain("t1")
			expect(genreIsIds).toContain("t4")

			const moodIncludesIds = await queryTracks(
				db,
				parseBlueprint({ rules: [{ mood: { includes: "happy" } }] })
			)
			expect(
				moodIncludesIds,
				"mood includes 'happy' should match t1 and t4"
			).toHaveLength(2)
			expect(moodIncludesIds).toContain("t1")
			expect(moodIncludesIds).toContain("t4")
		})
	})

	describe("number operators", () => {
		it("should filter by greater_than", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { year: 1997 }),
					mockTrackData("t2", { year: 2000 }),
					mockTrackData("t3", { year: 2003 })
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ year: { greater_than: 1999 } }] })
			)

			expect(ids).toHaveLength(2)
			expect(ids).toContain("t2")
			expect(ids).toContain("t3")
		})

		it("should filter by in_the_range (inclusive)", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { year: 1997 }),
					mockTrackData("t2", { year: 2000 }),
					mockTrackData("t3", { year: 2003 }),
					mockTrackData("t4", { year: 2010 })
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ year: { in_the_range: [2000, 2005] } }] })
			)

			expect(ids, "should include range endpoints").toHaveLength(2)
			expect(ids).toContain("t2")
			expect(ids).toContain("t3")
		})

		it("should filter by is with number and return empty for no matches", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { year: 2000, artist: "Radiohead" }),
					mockTrackData("t2", { year: 2001, artist: "Beatles" })
				]
			})

			const isIds = await queryTracks(
				db,
				parseBlueprint({ rules: [{ year: { is: 2000 } }] })
			)
			expect(isIds, "should match exact year").toEqual(["t1"])

			// done-todo merge this with seedTracks, its always the same pattern and we can just provide tracks directly. One line less per test
			const emptyIds = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { is: "nonexistent" } }] })
			)
			expect(emptyIds, "should return empty when no tracks match").toEqual([])
		})
	})

	describe("date operators", () => {
		it("should filter by in_the_last", async () => {
			const now = Date.now()
			const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000)
			const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000)

			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { releasedate: twoDaysAgo }),
					mockTrackData("t2", { releasedate: tenDaysAgo })
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({
					rules: [{ releasedate: { in_the_last: { days: 7 } } }]
				})
			)

			expect(ids, "should only include track from 2 days ago").toEqual(["t1"])
		})
	})

	describe("boolean operators", () => {
		it("should filter by is true", async () => {
			const db = await createTestDrizzleDb({
				tracks: [
					mockTrackData("t1", { compilation: true }),
					mockTrackData("t2", { compilation: false }),
					mockTrackData("t3")
				]
			})

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ compilation: { is: true } }] })
			)

			expect(ids).toEqual(["t1"])
		})
	})

	// done-todo merge with other tests, try to merge as many tests as possible. The goal is to have less code to maintain. It doesnt matter if tests test multiple things
})

// done-todo dont use unknown here, it should be typed and dont break if the schema changes
function parseBlueprint(
	input: z.input<typeof playlistBlueprintSchema>
): PlaylistBlueprint {
	return playlistBlueprintSchema.parse(input)
}

async function queryTracks(
	db: DrizzleDatabase,
	blueprint: PlaylistBlueprint
): Promise<readonly string[]> {
	const result = await getSmartPlaylistTracks(db, blueprint)
	const tracks = result.getOrThrow()

	return tracks.map((track) => track.id)
}
