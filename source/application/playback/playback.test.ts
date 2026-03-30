import { describe, expect, it, mock } from "bun:test"
import { filter, firstValueFrom } from "rxjs"
import { createCommandCallbacks } from "#/application/commands/callbacks"
import { createTestContext } from "#/test-helpers/createTestContext"
import { mockTrackData, trackId } from "#/test-helpers/testHelpers"
import { handleAudioPlayback } from "./playback"
import type { Player } from "#/ports/player"
import type { TestContext } from "#/test-helpers/createTestContext"

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

	const { getCommandCallback } = createCommandCallbacks({
		appState: context.appState,
		player
	})

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

	return {
		context,
		player: player as MockedPlayer,
		[Symbol.asyncDispose]: async () => cleanup()
	}
}

/** Wait for the playback state to reach "playing" and the player to receive the command */
async function waitForPlaying(context: TestContext): Promise<void> {
	await firstValueFrom(
		context.derived.playState$.pipe(filter((state) => state === "playing"))
	)
	// Yield to let the async subscribe callback in handlePlayer complete the player.play() call
	await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("handleAudioPlayback", () => {
	it("plays the next track when nextTrack is dispatched", async () => {
		await using test = await createPlaybackTest()

		await test.context.playNewPlayback({ source: { type: "all" } })
		await waitForPlaying(test.context)

		expect(test.player.play, "should play first track").toHaveBeenCalledWith(
			trackId("track-0")
		)

		test.context.appState.send({ type: "nextTrack" })
		await waitForPlaying(test.context)

		expect(test.player.play, "should play second track").toHaveBeenCalledWith(
			trackId("track-1")
		)
	})

	it("advances to the next track when finishedTrack event fires", async () => {
		// done-todo `await using` requires a single binding for [Symbol.asyncDispose] — destructuring would break cleanup
		await using test = await createPlaybackTest()

		await test.context.playNewPlayback({ source: { type: "all" } })
		await waitForPlaying(test.context)

		expect(test.player.play, "should play first track").toHaveBeenCalledWith(
			trackId("track-0")
		)

		test.player.emitEvent({
			type: "finishedTrack",
			trackId: trackId("track-0")
		})
		await waitForPlaying(test.context)

		expect(
			test.context.appState.getSnapshot().context.playback.index,
			"index should advance to 1"
		).toBe(1)
		expect(test.player.play, "should play second track").toHaveBeenCalledWith(
			trackId("track-1")
		)
	})

	it("does not double-advance when a stale finishedTrack arrives after nextTrack", async () => {
		await using test = await createPlaybackTest(5)

		await test.context.playNewPlayback({ source: { type: "all" } })
		await waitForPlaying(test.context)

		expect(test.player.play, "should play first track").toHaveBeenCalledWith(
			trackId("track-0")
		)

		// Simulate the race: user presses next, then a stale EOF from the old track arrives
		test.context.appState.send({ type: "nextTrack" })
		test.player.emitEvent({
			type: "finishedTrack",
			trackId: trackId("track-0")
		})
		await waitForPlaying(test.context)

		const state = test.context.appState.getSnapshot().context.playback
		expect(state.index, "should be at index 1, not 2").toBe(1)
		expect(state.playState, "should still be playing").toBe("playing")
	})

	it("replays the same track on finishedTrack when loop_track is active", async () => {
		await using test = await createPlaybackTest()

		await test.context.playNewPlayback({ source: { type: "all" } })
		await waitForPlaying(test.context)

		// Enable loop_track: none → loop_queue → loop_track
		test.context.appState.send({ type: "cycleLoop" })
		test.context.appState.send({ type: "cycleLoop" })
		expect(
			test.context.appState.getSnapshot().context.playback.loopState,
			"should be loop_track"
		).toBe("loop_track")

		const callCountBefore = (test.player.play as ReturnType<typeof mock>).mock
			.calls.length

		test.player.emitEvent({
			type: "finishedTrack",
			trackId: trackId("track-0")
		})
		await waitForPlaying(test.context)

		const state = test.context.appState.getSnapshot().context.playback
		expect(state.index, "index should stay at 0").toBe(0)
		expect(
			(test.player.play as ReturnType<typeof mock>).mock.calls.length,
			"player.play should be called again for the same track"
		).toBeGreaterThan(callCountBefore)
	})

	it("settles on the correct track after rapid next presses", async () => {
		await using test = await createPlaybackTest(5)

		await test.context.playNewPlayback({ source: { type: "all" } })
		await waitForPlaying(test.context)

		test.context.appState.send({ type: "nextTrack" })
		test.context.appState.send({ type: "nextTrack" })
		test.context.appState.send({ type: "nextTrack" })
		await waitForPlaying(test.context)

		const state = test.context.appState.getSnapshot().context.playback
		expect(state.index, "should be at index 3").toBe(3)
		expect(test.player.play, "should play track-3").toHaveBeenCalledWith(
			trackId("track-3")
		)
	})
})
