import { describe, expect, it } from "bun:test"
import { firstValueFrom } from "rxjs"
import { mockTrackData } from "#/test-helpers/testHelpers"
import { createMemoryDatabase } from "./createMemoryDatabase"
import type { TrackId } from "#/ports/database"

describe("database integration", () => {
	it("upsert tracks and query them back", async () => {
		const database = await createMemoryDatabase()
		const track = mockTrackData("track-1")

		await database.upsertTracks([track])

		const result = await database.getTracks()
		const tracks = result.getOrThrow()

		expect(tracks, "should return exactly one track").toHaveLength(1)
		expect(tracks[0]!.id, "should preserve the track id").toBe(
			"track-1" as TrackId
		)
		expect(tracks[0]!.title, "should store the title from input").toBe(
			"Track track-1"
		)
	})

	it("upsert triggers changed$", async () => {
		const database = await createMemoryDatabase()

		const changedPromise = firstValueFrom(database.changed$)
		await database.upsertTracks([mockTrackData("track-1")])

		const changed = await changedPromise
		expect(changed).toBeDefined()
	})

	it("getTrack returns specific track or error for missing", async () => {
		const database = await createMemoryDatabase()
		await database.upsertTracks([
			mockTrackData("track-1"),
			mockTrackData("track-2")
		])

		const result = await database.getTrack("track-1" as TrackId)
		const track = result.getOrThrow()
		expect(track.id, "should return the requested track").toBe(
			"track-1" as TrackId
		)
		expect(track.title, "should have the correct title").toBe("Track track-1")

		const missing = await database.getTrack("nonexistent" as TrackId)
		expect(missing.isError(), "missing track returns error").toBe(true)
	})

	it("deleteTracksInverted removes tracks not in the list", async () => {
		const database = await createMemoryDatabase()
		await database.upsertTracks([
			mockTrackData("keep-1"),
			mockTrackData("keep-2"),
			mockTrackData("remove-1")
		])

		await database.deleteTracksInverted([
			"keep-1" as TrackId,
			"keep-2" as TrackId
		])

		const result = await database.getTracks()
		const tracks = result.getOrThrow()

		expect(tracks, "should only contain the kept tracks").toHaveLength(2)
		expect(
			tracks.map((track) => track.id),
			"should retain keep-1"
		).toContain("keep-1" as TrackId)
		expect(
			tracks.map((track) => track.id),
			"should retain keep-2"
		).toContain("keep-2" as TrackId)
	})

	it("upsert updates existing track data", async () => {
		const database = await createMemoryDatabase()

		await database.upsertTracks([mockTrackData("track-1")])
		await database.upsertTracks([
			{
				...mockTrackData("track-1"),
				title: "Updated Title"
			}
		])

		const result = await database.getTrack("track-1" as TrackId)
		const track = result.getOrThrow()

		expect(track.title).toBe("Updated Title")
	})
})
