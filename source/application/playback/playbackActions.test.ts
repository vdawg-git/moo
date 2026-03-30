import { describe, expect, it, mock } from "bun:test"
import { createMemoryDatabase } from "#/adapters/sqlite/createMemoryDatabase"
import { createAppState } from "#/core/state/state"
import { mockTrackData } from "#/test-helpers/testHelpers"
import { createPlaybackActions } from "./playbackActions"
import type { ErrorNotificationFn } from "#/shared/types/types"

describe("createPlaybackActions", () => {
	it("should start new playback with all tracks for source type 'all'", async () => {
		const { appState, actions } = await createTestPlayback({
			tracks: ["track-1", "track-2", "track-3"]
		})

		await actions.playNewPlayback({ source: { type: "all" } })

		const state = appState.getSnapshot().context.playback
		expect(state.queue, "queue should be set").toBeDefined()
		expect(state.queue!.tracks, "should have all 3 tracks").toHaveLength(3)
		expect(state.queue!.source.type, "source should be 'all'").toBe("all")
		expect(state.playState, "should start playing").toBe("playing")
	})

	it("should toggle playback when same source and index are played again", async () => {
		const { appState, actions } = await createTestPlayback({
			tracks: ["track-1"]
		})

		await actions.playNewPlayback({ source: { type: "all" }, index: 0 })
		expect(
			appState.getSnapshot().context.playback.playState,
			"should be playing after first call"
		).toBe("playing")

		await actions.playNewPlayback({ source: { type: "all" }, index: 0 })
		expect(
			appState.getSnapshot().context.playback.playState,
			"should toggle to paused on second call"
		).toBe("paused")
	})

	it("should start playback from a specific index", async () => {
		const { appState, actions } = await createTestPlayback({
			tracks: ["track-0", "track-1", "track-2"]
		})

		await actions.playNewPlayback({ source: { type: "all" }, index: 2 })

		const state = appState.getSnapshot().context.playback
		expect(state.index, "should start at index 2").toBe(2)
	})

	it("should call addErrorNotification when playlist is not found", async () => {
		const { actions, addErrorNotification } = await createTestPlayback()

		await actions.playNewPlayback({
			source: { type: "playlist", id: "nonexistent" as any }
		})

		expect(
			addErrorNotification,
			"should notify error for missing playlist"
		).toHaveBeenCalledTimes(1)
	})

	it("should call addErrorNotification when album is not found", async () => {
		const { actions, addErrorNotification } = await createTestPlayback()

		await actions.playNewPlayback({
			source: { type: "album", id: "nonexistent" as any }
		})

		expect(
			addErrorNotification,
			"should notify error for missing album"
		).toHaveBeenCalledTimes(1)
	})

	it("should call addErrorNotification when artist is not found", async () => {
		const { actions, addErrorNotification } = await createTestPlayback()

		await actions.playNewPlayback({
			source: { type: "artist", id: "nonexistent" as any }
		})

		expect(
			addErrorNotification,
			"should notify error for missing artist"
		).toHaveBeenCalledTimes(1)
	})
})

async function createTestPlayback(options?: {
	readonly tracks?: readonly Parameters<typeof mockTrackData>[0][]
}) {
	const tracks = options?.tracks?.map((id) => mockTrackData(id))
	const database = await createMemoryDatabase({ tracks })
	const { appState } = createAppState()
	const addErrorNotification = mock<ErrorNotificationFn>(() => {})

	const actions = createPlaybackActions({
		database,
		appState,
		addErrorNotification
	})

	return { database, appState, addErrorNotification, actions }
}
