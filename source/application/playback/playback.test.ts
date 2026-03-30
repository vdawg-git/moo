import { describe, expect, it, mock } from "bun:test"
import { createCommandCallbacks } from "#/application/commands/callbacks"
import { createTestContext } from "#/test-helpers/createTestContext"
import { mockTrackData, trackId } from "#/test-helpers/testHelpers"
import { handleAudioPlayback } from "./playback"
import type { Player } from "#/ports/player"

type MockedPlayer = Player & {
	readonly emitEvent: ReturnType<
		typeof import("#/test-helpers/mockPlayer").createMockPlayer
	>["emitEvent"]
}

async function createPlaybackTest(trackCount = 3) {
	const context = await createTestContext()

	const trackNames = Array.from({ length: trackCount }, (_, index) =>
		mockTrackData(`track-${index}`)
	)
	await context.database.upsertTracks(trackNames)

	const player = context.mockPlayer
	// todo the mockPlayer should already have these methods mocked, we shouldnt have to do it here. Refactor createMockPlayer to return the player with the methods already mocked
	player.play = mock(player.play)
	player.pause = mock(player.pause)
	player.clear = mock(player.clear)

	const { getCommandCallback } = createCommandCallbacks({
		appState: context.appState,
		player
	})

	// todo use the using keyword to auto-cleanup the subscription. We should do this for all tests that subscribe to something, which is most of them in this file. This will make sure we dont have to manually call cleanup and we wont forget to call it, which can lead to flaky tests
	const cleanup = handleAudioPlayback({
		appState: context.appState,
		appState$: context.appState$,
		currentTrack$: context.derived.currentTrack$,
		playState$: context.derived.playState$,
		loop$: context.derived.loop$,
		player,
		addErrorNotification: context.notifications.addError,
		keybindManager: context.keybindManager,
		getCommandCallback,
		keybindings: context.config.keybindings
	})

	return { context, player: player as MockedPlayer, cleanup }
}

/** Give the async observable pipeline time to settle */
async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 50))
}

describe("handleAudioPlayback", () => {
	it("plays the next track when nextTrack is dispatched", async () => {
		const { context, player, cleanup } = await createPlaybackTest()

		await context.playNewPlayback({ source: { type: "all" } })
		await settle()

		expect(player.play, "should play first track").toHaveBeenCalledWith(
			trackId("track-0")
		)

		context.appState.send({ type: "nextTrack" })
		await settle()

		expect(player.play, "should play second track").toHaveBeenCalledWith(
			trackId("track-1")
		)

		cleanup()
	})

	it("advances to the next track when finishedTrack event fires", async () => {
		const { context, player, cleanup } = await createPlaybackTest()

		await context.playNewPlayback({ source: { type: "all" } })
		await settle()

		expect(player.play, "should play first track").toHaveBeenCalledWith(
			trackId("track-0")
		)

		player.emitEvent({ type: "finishedTrack" })
		await settle()

		expect(
			context.appState.getSnapshot().context.playback.index,
			"index should advance to 1"
		).toBe(1)
		expect(player.play, "should play second track").toHaveBeenCalledWith(
			trackId("track-1")
		)

		cleanup()
	})

	it("does not double-advance when a stale finishedTrack arrives after nextTrack", async () => {
		const { context, player, cleanup } = await createPlaybackTest(5)

		await context.playNewPlayback({ source: { type: "all" } })
		await settle()

		expect(player.play, "should play first track").toHaveBeenCalledWith(
			trackId("track-0")
		)

		// Simulate the race: user presses next, then a stale EOF from the old track arrives
		context.appState.send({ type: "nextTrack" })
		player.emitEvent({ type: "finishedTrack" })
		await settle()

		const state = context.appState.getSnapshot().context.playback
		expect(state.index, "should be at index 1, not 2").toBe(1)
		expect(state.playState, "should still be playing").toBe("playing")

		cleanup()
	})

	it("replays the same track on finishedTrack when loop_track is active", async () => {
		const { context, player, cleanup } = await createPlaybackTest()

		await context.playNewPlayback({ source: { type: "all" } })
		await settle()

		// Enable loop_track: none → loop_queue → loop_track
		context.appState.send({ type: "cycleLoop" })
		context.appState.send({ type: "cycleLoop" })
		expect(
			context.appState.getSnapshot().context.playback.loopState,
			"should be loop_track"
		).toBe("loop_track")

		const callCountBefore = (player.play as ReturnType<typeof mock>).mock.calls
			.length

		player.emitEvent({ type: "finishedTrack" })
		await settle()

		const state = context.appState.getSnapshot().context.playback
		expect(state.index, "index should stay at 0").toBe(0)
		expect(
			(player.play as ReturnType<typeof mock>).mock.calls.length,
			"player.play should be called again for the same track"
		).toBeGreaterThan(callCountBefore)

		cleanup()
	})

	it("settles on the correct track after rapid next presses", async () => {
		const { context, player, cleanup } = await createPlaybackTest(5)

		await context.playNewPlayback({ source: { type: "all" } })
		// todo this is a hack. Figure out smth better. Like awaiting the appState to reach a certain state or smth. The problem is we need to wait for the initial play to settle before we can send the nextTrack events, otherwise they might be ignored or cause
		await settle()

		context.appState.send({ type: "nextTrack" })
		context.appState.send({ type: "nextTrack" })
		context.appState.send({ type: "nextTrack" })
		await settle()

		const state = context.appState.getSnapshot().context.playback
		expect(state.index, "should be at index 3").toBe(3)
		// todo Im not a fan of toHaveBeenCalledWith, what about some state in the player which simply says which track is currently playing?
		expect(player.play, "should play track-3").toHaveBeenCalledWith(
			trackId("track-3")
		)

		cleanup()
	})
})
