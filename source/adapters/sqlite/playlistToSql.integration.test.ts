import { describe, expect, it } from "bun:test"
import { createTestDrizzleDb } from "#/adapters/sqlite/createMemoryDatabase"
import { getSmartPlaylistTracks } from "#/adapters/sqlite/playlistToSql"
import { tableTracks } from "#/adapters/sqlite/schema"
import { playlistBlueprintSchema } from "#/core/playlists/schema"
import { mockTrackData } from "#/test-helpers/testHelpers"
import type { DrizzleDatabase } from "#/adapters/sqlite/drizzleTypes"
import type { PlaylistBlueprint } from "#/core/playlists/schema"
import type { TrackData } from "#/ports/database"

describe("getSmartPlaylistTracks", () => {
	describe("string operators", () => {
		it("should filter by includes (case-insensitive)", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { artist: "Radiohead" }),
				mockTrackData("t2", { artist: "radiohead live" }),
				mockTrackData("t3", { artist: "Beatles" })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { includes: "radiohead" } }] })
			)

			expect(ids, "should match case-insensitively").toHaveLength(2)
			expect(ids).toContain("t1")
			expect(ids).toContain("t2")
		})

		it("should filter by is (exact, case-insensitive)", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { artist: "Radiohead" }),
				mockTrackData("t2", { artist: "radiohead" }),
				mockTrackData("t3", { artist: "Radiohead Live" })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { is: "radiohead" } }] })
			)

			expect(ids, "exact match should not include partial").toHaveLength(2)
			expect(ids).toContain("t1")
			expect(ids).toContain("t2")
		})

		it("should filter by is_not", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { artist: "Radiohead" }),
				mockTrackData("t2", { artist: "Beatles" })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { is_not: "radiohead" } }] })
			)

			expect(ids, "should exclude Radiohead").toEqual(["t2"])
		})

		it("should filter by starts_with", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { title: "OK Computer" }),
				mockTrackData("t2", { title: "Kid A" }),
				mockTrackData("t3", { title: "Ok not" })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ title: { starts_with: "ok" } }] })
			)

			expect(ids).toHaveLength(2)
			expect(ids).toContain("t1")
			expect(ids).toContain("t3")
		})

		it("should filter by ends_with", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { title: "OK Computer" }),
				mockTrackData("t2", { title: "My Computer" }),
				mockTrackData("t3", { title: "Kid A" })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ title: { ends_with: "computer" } }] })
			)

			expect(ids).toHaveLength(2)
			expect(ids).toContain("t1")
			expect(ids).toContain("t2")
		})

		it("should filter by includes_not", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { artist: "Radiohead" }),
				mockTrackData("t2", { artist: "Beatles" }),
				mockTrackData("t3", { artist: "Radio Moscow" })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { includes_not: "radio" } }] })
			)

			expect(ids, "should exclude tracks containing 'radio'").toEqual(["t2"])
		})
	})

	describe("logical grouping", () => {
		it("should AND top-level rules", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { artist: "Radiohead", year: 1997 }),
				mockTrackData("t2", { artist: "Radiohead", year: 2003 }),
				mockTrackData("t3", { artist: "Beatles", year: 2003 })
			])

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
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { artist: "Radiohead" }),
				mockTrackData("t2", { artist: "Beatles" }),
				mockTrackData("t3", { artist: "Pink Floyd" })
			])

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
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { artist: "Radiohead", year: 2000 }),
				mockTrackData("t2", { artist: "Radiohead", year: 1997 }),
				mockTrackData("t3", { artist: "Beatles", year: 2000 })
			])

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
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { artist: "Radiohead", year: 2003 }),
				mockTrackData("t2", { artist: "Beatles", year: 2003 }),
				mockTrackData("t3", { artist: "Radiohead", year: 1997 }),
				mockTrackData("t4", { artist: "Pink Floyd", year: 2003 })
			])

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

	describe("array columns (json_each)", () => {
		it("should filter genre array by includes", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { genre: ["rock", "alternative"] }),
				mockTrackData("t2", { genre: ["pop"] }),
				mockTrackData("t3", { genre: ["rock"] })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ genre: { includes: "rock" } }] })
			)

			expect(
				ids,
				"should match tracks with 'rock' in genre array"
			).toHaveLength(2)
			expect(ids).toContain("t1")
			expect(ids).toContain("t3")
		})

		it("should filter genre array by is (exact element match)", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { genre: ["rock", "alternative"] }),
				mockTrackData("t2", { genre: ["alternative"] })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ genre: { is: "alternative" } }] })
			)

			expect(ids, "should match both tracks having 'alternative'").toHaveLength(
				2
			)
		})

		// todo merge most of those tests. Just give it more tracks and give the expect calls a proper error message
		it("should filter mood array", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { mood: ["happy", "energetic"] }),
				mockTrackData("t2", { mood: ["sad"] })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ mood: { includes: "happy" } }] })
			)

			expect(ids).toEqual(["t1"])
		})
	})

	describe("number operators", () => {
		it("should filter by greater_than", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { year: 1997 }),
				mockTrackData("t2", { year: 2000 }),
				mockTrackData("t3", { year: 2003 })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ year: { greater_than: 1999 } }] })
			)

			expect(ids).toHaveLength(2)
			expect(ids).toContain("t2")
			expect(ids).toContain("t3")
		})

		it("should filter by in_the_range (inclusive)", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { year: 1997 }),
				mockTrackData("t2", { year: 2000 }),
				mockTrackData("t3", { year: 2003 }),
				mockTrackData("t4", { year: 2010 })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ year: { in_the_range: [2000, 2005] } }] })
			)

			expect(ids, "should include range endpoints").toHaveLength(2)
			expect(ids).toContain("t2")
			expect(ids).toContain("t3")
		})

		it("should filter by is with number", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { year: 2000 }),
				mockTrackData("t2", { year: 2001 })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ year: { is: 2000 } }] })
			)

			expect(ids).toEqual(["t1"])
		})
	})

	describe("date operators", () => {
		it("should filter by in_the_last", async () => {
			const db = await createTestDrizzleDb()
			const now = Date.now()
			const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000)
			const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000)

			await seedTracks(db, [
				mockTrackData("t1", { releasedate: twoDaysAgo }),
				mockTrackData("t2", { releasedate: tenDaysAgo })
			])

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
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { compilation: true }),
				mockTrackData("t2", { compilation: false }),
				mockTrackData("t3")
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ compilation: { is: true } }] })
			)

			expect(ids).toEqual(["t1"])
		})
	})

	describe("edge cases", () => {
		it("should return empty array when no tracks match", async () => {
			// todo merge this with seedTracks, its always the same pattern and we can just provide tracks directly. One line less per test
			const db = await createTestDrizzleDb()
			await seedTracks(db, [mockTrackData("t1", { artist: "Radiohead" })])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { is: "nonexistent" } }] })
			)

			expect(ids).toEqual([])
		})

		// todo merge with other tests, try to merge as many tests as possible. The goal is to have less code to maintain. It doesnt matter if tests test multiple things
		it("should not match NULL values with positive filters", async () => {
			const db = await createTestDrizzleDb()
			await seedTracks(db, [
				mockTrackData("t1", { artist: "Radiohead" }),
				mockTrackData("t2", { artist: undefined })
			])

			const ids = await queryTracks(
				db,
				parseBlueprint({ rules: [{ artist: { includes: "Radio" } }] })
			)

			expect(ids, "NULL artist should not match includes").toEqual(["t1"])
		})
	})
})

// todo dont use unknown here, it should be typed and dont break if the schema changes
function parseBlueprint(input: unknown): PlaylistBlueprint {
	return playlistBlueprintSchema.parse(input)
}

async function seedTracks(
	db: DrizzleDatabase,
	tracks: readonly TrackData[]
): Promise<void> {
	if (tracks.length === 0) return

	await db
		.insert(tableTracks)
		.values(tracks as TrackData[])
		.onConflictDoNothing()
}

async function queryTracks(
	db: DrizzleDatabase,
	blueprint: PlaylistBlueprint
): Promise<readonly string[]> {
	const result = await getSmartPlaylistTracks(db, blueprint)
	const tracks = result.getOrThrow()

	return tracks.map((track) => track.id)
}
