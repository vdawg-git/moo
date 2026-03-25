import { describe, expect, it } from "bun:test"
import { createTestContext } from "#/test-helpers/createTestContext"
import { mockTrackData } from "#/test-helpers/testHelpers"

describe("state integration", () => {
	it("playNewPlayback populates state queue", async () => {
		const context = await createTestContext()

		await context.database.upsertTracks([
			mockTrackData("track-1"),
			mockTrackData("track-2")
		])

		await context.playNewPlayback({ source: { type: "all" } })

		const state = context.appState.getSnapshot().context
		expect(state.playback.playState, "started playing").toBe("playing")
		expect(state.playback.queue, "queue was created").toBeDefined()
		expect(
			state.playback.queue!.tracks.length,
			"queue has tracks"
		).toBeGreaterThan(0)
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
		expect(stateBefore.playback.index, "starts at first track").toBe(0)

		context.appState.send({ type: "nextTrack" })

		const stateAfter = context.appState.getSnapshot().context
		expect(stateAfter.playback.index, "advanced to second track").toBe(1)
	})

	it("togglePlayback pauses and resumes", async () => {
		const context = await createTestContext()

		await context.database.upsertTracks([mockTrackData("track-1")])
		await context.playNewPlayback({ source: { type: "all" } })

		expect(
			context.appState.getSnapshot().context.playback.playState,
			"should be playing after playNewPlayback"
		).toBe("playing")

		context.appState.send({ type: "togglePlayback" })
		expect(
			context.appState.getSnapshot().context.playback.playState,
			"should pause after first toggle"
		).toBe("paused")

		context.appState.send({ type: "togglePlayback" })
		expect(
			context.appState.getSnapshot().context.playback.playState,
			"should resume after second toggle"
		).toBe("playing")
	})

	it("addErrorNotification creates a notification", async () => {
		const context = await createTestContext()

		context.notifications.addError("Something went wrong", new Error("test"))

		const state = context.appState.getSnapshot().context
		expect(state.notifications, "notification was added").toHaveLength(1)
		expect(state.notifications[0]!.type, "should be error type").toBe("error")
		expect(state.notifications[0]!.message, "should have correct message").toBe(
			"Something went wrong"
		)
	})
})
