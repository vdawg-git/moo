import { describe, expect, it } from "bun:test"
import { mockTrackData } from "#/testHelpers"
import { createTestContext } from "#/testing/createTestContext"

describe("state integration", () => {
	it("playNewPlayback populates state queue", async () => {
		const context = await createTestContext()

		await context.database.upsertTracks([
			mockTrackData("track-1"),
			mockTrackData("track-2")
		])

		await context.playNewPlayback({ source: { type: "all" } })

		const state = context.appState.getSnapshot().context
		expect(state.playback.playState).toBe("playing")
		expect(state.playback.queue).toBeDefined()
		expect(state.playback.queue!.tracks.length).toBeGreaterThan(0)
	})

	it("nextTrack advances the index", async () => {
		const context = await createTestContext()

		await context.database.upsertTracks([
			mockTrackData("track-1"),
			mockTrackData("track-2"),
			mockTrackData("track-3")
		])

		await context.playNewPlayback({ source: { type: "all" } })

		const stateBefore = context.appState.getSnapshot().context
		expect(stateBefore.playback.index).toBe(0)

		context.appState.send({ type: "nextTrack" })

		const stateAfter = context.appState.getSnapshot().context
		expect(stateAfter.playback.index).toBe(1)
	})

	it("togglePlayback pauses and resumes", async () => {
		const context = await createTestContext()

		await context.database.upsertTracks([mockTrackData("track-1")])
		await context.playNewPlayback({ source: { type: "all" } })

		expect(context.appState.getSnapshot().context.playback.playState).toBe(
			"playing"
		)

		context.appState.send({ type: "togglePlayback" })
		expect(context.appState.getSnapshot().context.playback.playState).toBe(
			"paused"
		)

		context.appState.send({ type: "togglePlayback" })
		expect(context.appState.getSnapshot().context.playback.playState).toBe(
			"playing"
		)
	})

	it("addErrorNotification creates a notification", async () => {
		const context = await createTestContext()

		context.notifications.addError("Something went wrong", new Error("test"))

		const state = context.appState.getSnapshot().context
		expect(state.notifications).toHaveLength(1)
		expect(state.notifications[0]!.type).toBe("error")
		expect(state.notifications[0]!.message).toBe("Something went wrong")
	})
})
