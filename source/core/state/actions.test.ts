import { describe, expect, it } from "bun:test"
import { appStateActionsInternal as actions } from "#/core/state/actions"
import {
	createInitialState,
	createMockQueue,
	trackId,
	trackIds,
	trackIdsRange
} from "#/test-helpers/testHelpers"
import type { AlbumId, ArtistId, PlaylistId } from "#/shared/types/brandedIds"

describe("stopPlayback", () => {
	it("should reset playback state to initial values", () => {
		const state = createInitialState({
			tracks: trackIdsRange(5),
			index: 2,
			manuallyAdded: trackIds("track-1", "track-2"),
			playState: "playing",
			shuffleMap: [0, 2, 1, 4, 3]
		})

		const newState = actions.stopPlayback(state)

		expect(newState.playback).toMatchObject({
			queue: undefined,
			index: 0,
			manuallyAdded: [],
			playState: "stopped",
			shuffleMap: []
		})
	})
})

describe("playNewPlayback", () => {
	it("should set new queue and start playing without shuffle", () => {
		const state = createInitialState()
		const queue = createMockQueue()

		const newState = actions.playNewPlayback(state, { queue, index: 2 })

		expect(newState.playback).toMatchObject({
			queue,
			index: 2,
			playState: "playing",
			isPlayingFromManualQueue: false
		})
	})

	it("should set new queue with default index 0", () => {
		const state = createInitialState()
		const queue = createMockQueue()

		const newState = actions.playNewPlayback(state, { queue })

		expect(newState.playback.index).toBe(0)
	})

	it("should shuffle tracks when shuffleMap is active", () => {
		const state = createInitialState({ shuffleMap: [] })
		const queue = createMockQueue(3)

		const newState = actions.playNewPlayback(state, { queue, index: 1 })

		expect(newState.playback.queue?.tracks).toHaveLength(3)
		expect(newState.playback.shuffleMap).toHaveLength(3)
		expect(newState.playback.queue?.source).toEqual(queue.source)
	})
})

describe("playFromManualQueue", () => {
	it("should start playing from manual queue at given index", () => {
		const added = trackIds("track-1", "track-2", "track-3")
		const state = createInitialState({ manuallyAdded: added })

		const newState = actions.playFromManualQueue(state, { index: 0 })

		expect(newState.playback).toMatchObject({
			isPlayingFromManualQueue: true,
			playState: "playing",
			manuallyAdded: added
		})
	})

	it("should slice manual queue when index > 0", () => {
		const state = createInitialState({
			manuallyAdded: trackIds("1", "2", "3")
		})

		const newState = actions.playFromManualQueue(state, { index: 1 })

		expect(newState.playback.manuallyAdded).toEqual(trackIds("2", "3"))
	})

	it("should not modify state when index is out of bounds", () => {
		const state = createInitialState({ manuallyAdded: trackIds("1") })

		const newState = actions.playFromManualQueue(state, { index: 5 })

		expect(newState.playback.isPlayingFromManualQueue).toBe(false)
	})
})

describe("playIndex", () => {
	it("should set playback index and start playing", () => {
		const state = createInitialState({ tracks: trackIdsRange(5) })

		const newState = actions.playIndex(state, { index: 3 })

		expect(newState.playback).toMatchObject({
			index: 3,
			playState: "playing",
			isPlayingFromManualQueue: false
		})
	})

	it("should handle index out of bounds gracefully", () => {
		const state = createInitialState({ tracks: trackIdsRange(3) })

		const newState = actions.playIndex(state, { index: 5 })

		expect(newState.playback.playState).toBe("playing")
	})

	it("should handle no queue gracefully", () => {
		const state = createInitialState()

		const newState = actions.playIndex(state, { index: 0 })

		expect(newState.playback.playState).toBe("playing")
	})
})

describe("nextTrack", () => {
	it("should advance to next track", () => {
		const state = createInitialState({
			tracks: trackIdsRange(5),
			index: 1
		})

		const newState = actions.nextTrack(state)

		expect(newState.playback.index).toBe(2)
	})

	it("should loop to beginning when at end with loop_queue", () => {
		const state = createInitialState({
			tracks: trackIdsRange(3),
			index: 2,
			loopState: "loop_queue"
		})

		const newState = actions.nextTrack(state)

		expect(newState.playback.index).toBe(0)
	})

	it("should not change when no queue exists", () => {
		const state = createInitialState()

		const newState = actions.nextTrack(state)

		expect(newState.playback.index).toBe(0)
	})

	it("should switch to manual queue when items exist", () => {
		const state = createInitialState({
			tracks: trackIdsRange(5),
			manuallyAdded: trackIds("manual-1", "manual-2"),
			index: 1
		})

		const newState = actions.nextTrack(state)

		expect(newState.playback).toMatchObject({
			isPlayingFromManualQueue: true,
			index: 1,
			manuallyAdded: trackIds("manual-1", "manual-2")
		})
	})

	it("should consume current manual track and stay on manual queue", () => {
		const state = createInitialState({
			tracks: trackIdsRange(5),
			manuallyAdded: trackIds("manual-1", "manual-2"),
			isPlayingFromManualQueue: true
		})

		const newState = actions.nextTrack(state)

		expect(newState.playback).toMatchObject({
			isPlayingFromManualQueue: true,
			manuallyAdded: trackIds("manual-2")
		})
	})

	it("should fall back to auto queue after exhausting manual queue", () => {
		const state = createInitialState({
			tracks: trackIdsRange(5),
			manuallyAdded: trackIds("manual-1"),
			isPlayingFromManualQueue: true,
			index: 2
		})

		const newState = actions.nextTrack(state)

		expect(newState.playback).toMatchObject({
			isPlayingFromManualQueue: false,
			manuallyAdded: [],
			index: 3
		})
	})

	it("should stop when auto queue exhausted after manual queue", () => {
		const state = createInitialState({
			tracks: trackIdsRange(3),
			manuallyAdded: trackIds("manual-1"),
			isPlayingFromManualQueue: true,
			index: 2
		})

		const newState = actions.nextTrack(state)

		expect(newState.playback).toMatchObject({
			isPlayingFromManualQueue: false,
			playState: "stopped"
		})
	})
})

describe("previousTrack", () => {
	it("should go to previous track", () => {
		const state = createInitialState({
			tracks: trackIdsRange(5),
			index: 2
		})

		const newState = actions.previousTrack(state)

		expect(newState.playback.index).toBe(1)
	})

	it("should loop to end when at beginning with loop_queue", () => {
		const state = createInitialState({
			tracks: trackIdsRange(5),
			index: 0,
			loopState: "loop_queue"
		})

		const newState = actions.previousTrack(state)

		expect(newState.playback.index).toBe(4)
	})

	it("should exit manual queue and consume the current manual queue item, then resume auto queue at same index", () => {
		const state = createInitialState({
			tracks: trackIdsRange(5),
			manuallyAdded: trackIds("manual-1", "manual-2"),
			isPlayingFromManualQueue: true,
			index: 3
		})

		const newState = actions.previousTrack(state)

		expect(newState.playback).toMatchObject({
			isPlayingFromManualQueue: false,
			index: 3,
			manuallyAdded: trackIds("manual-2")
		})
	})
})

describe("togglePlayback", () => {
	it("pauses when playing, plays when paused, no-ops without queue", () => {
		const playingState = createInitialState({
			tracks: trackIdsRange(5),
			playState: "playing"
		})
		expect(
			actions.togglePlayback(playingState).playback.playState,
			"pause when playing"
		).toBe("paused")

		const pausedState = createInitialState({
			tracks: trackIdsRange(5),
			playState: "paused"
		})
		expect(
			actions.togglePlayback(pausedState).playback.playState,
			"play when paused"
		).toBe("playing")

		const noQueueState = createInitialState()
		expect(
			actions.togglePlayback(noQueueState).playback.playState,
			"no-op without queue"
		).toBe("stopped")
	})
})

describe("toggleShuffle", () => {
	it("should enable shuffle when disabled", () => {
		const state = createInitialState({
			tracks: trackIdsRange(4),
			index: 1
		})

		const newState = actions.toggleShuffle(state)

		expect(
			newState.playback.shuffleMap,
			"should create a shuffle map"
		).toBeDefined()
		expect(
			newState.playback.shuffleMap,
			"should have one entry per track"
		).toHaveLength(4)
	})

	it("should disable shuffle when enabled", () => {
		const state = createInitialState({
			tracks: trackIdsRange(4),
			shuffleMap: [2, 0, 3, 1],
			index: 2
		})

		const newState = actions.toggleShuffle(state)

		expect(
			newState.playback.shuffleMap,
			"should remove the shuffle map"
		).toBeUndefined()
		expect(newState.playback.index, "index restored to original").toBe(3)
	})

	it("should handle no queue with shuffle toggle", () => {
		const state = createInitialState()

		const newState = actions.toggleShuffle(state)

		expect(newState.playback.shuffleMap).toEqual([])
	})
})

describe("addToManualQueueFirst", () => {
	it("should add track to beginning of manual queue", () => {
		const state = createInitialState({ manuallyAdded: trackIds("1") })

		const newState = actions.addToManualQueueFirst(state, {
			trackId: trackId("2")
		})

		expect(newState.playback.manuallyAdded).toEqual(trackIds("2", "1"))
	})
})

describe("addToManualQueueLast", () => {
	it("should add track to end of manual queue", () => {
		const state = createInitialState({
			manuallyAdded: trackIds("track-1")
		})

		const newState = actions.addToManualQueueLast(state, {
			trackId: trackId("track-2")
		})

		expect(newState.playback.manuallyAdded).toEqual(
			trackIds("track-1", "track-2")
		)
	})
})

describe("removeFromManualQueue", () => {
	it("should remove track at given index", () => {
		const given = trackIdsRange(3)
		const expected = [given[0]!, given[2]!]
		const state = createInitialState({ manuallyAdded: given })

		const newState = actions.removeFromManualQueue(state, { index: 1 })

		expect(newState.playback.manuallyAdded).toEqual(expected)
	})
})

describe("removeFromQueue", () => {
	it("should remove track from queue at given index", () => {
		const given = trackIdsRange(3)
		const expected = [given[0]!, given[2]!]
		const state = createInitialState({ tracks: given })

		const newState = actions.removeFromQueue(state, { index: 1 })

		expect(newState.playback.queue?.tracks).toEqual(expected) // Bug: splice returns removed items
	})

	it("should handle no queue gracefully", () => {
		const state = createInitialState()

		const newState = actions.removeFromQueue(state, { index: 0 })

		expect(newState.playback.queue).toBeUndefined()
	})
})

describe("navigateTo", () => {
	it("should add new page to history", () => {
		const state = createInitialState()
		const newPage = {
			route: "album" as const,
			parameter: { id: "album-1" as AlbumId }
		}

		const newState = actions.navigateTo(state, { goTo: newPage })

		expect(newState.view.history, "page appended to history").toHaveLength(2)
		expect(newState.view.history[1], "new page at end").toEqual(newPage)
		expect(newState.view.historyIndex, "index points to new page").toBe(1)
	})

	it("should not navigate to same page", () => {
		const state = createInitialState()
		const currentPage = { route: "home" as const }

		const newState = actions.navigateTo(state, { goTo: currentPage })

		expect(newState.view.history, "history unchanged").toHaveLength(1)
		expect(newState.view.historyIndex, "index unchanged").toBe(0)
	})

	it("should replace forward history when navigating from middle", () => {
		const state = createInitialState()
		state.view.history = [
			{ route: "home" },
			{ route: "album", parameter: { id: "album-1" as AlbumId } },
			{ route: "artist", parameter: { id: "artist-1" as ArtistId } }
		]
		state.view.historyIndex = 1

		const newPage = {
			route: "playlist" as const,
			parameter: { id: "playlist-1" as PlaylistId }
		}
		const newState = actions.navigateTo(state, { goTo: newPage })

		expect(newState.view.history, "forward entries replaced").toHaveLength(3)
		expect(newState.view.history[2], "new page replaced artist").toEqual(
			newPage
		)
		expect(newState.view.historyIndex, "should point to newest page").toBe(2)
	})
})

describe("navigateBack", () => {
	it("goes back in history and clamps at beginning", () => {
		const state = createInitialState()
		state.view.history = [
			{ route: "home" },
			{ route: "album", parameter: { id: "album-1" as AlbumId } }
		]
		state.view.historyIndex = 1

		const afterBack = actions.navigateBack(state)
		expect(afterBack.view.historyIndex, "goes back").toBe(0)

		const atBeginning = createInitialState()
		expect(
			actions.navigateBack(atBeginning).view.historyIndex,
			"clamps at beginning"
		).toBe(0)
	})
})

describe("navigateForward", () => {
	it("goes forward in history and clamps at end", () => {
		const state = createInitialState()
		state.view.history = [
			{ route: "home" },
			{ route: "album", parameter: { id: "album-1" as AlbumId } }
		]
		state.view.historyIndex = 0

		const afterForward = actions.navigateForward(state)
		expect(afterForward.view.historyIndex, "goes forward").toBe(1)

		const atEnd = createInitialState()
		expect(
			actions.navigateForward(atEnd).view.historyIndex,
			"clamps at end"
		).toBe(0)
	})
})

describe("addNotification", () => {
	it("should add notification to state", () => {
		const state = createInitialState()
		const notification = {
			type: "success" as const,
			message: "Test notification",
			id: "test-id"
		}

		const newState = actions.addNotification(state, { notification })

		expect(newState.notifications, "should have one notification").toHaveLength(
			1
		)
		expect(
			newState.notifications[0],
			"should store the provided notification"
		).toEqual(notification)
	})
})

describe("clearNotifications", () => {
	it("should clear all notifications", () => {
		const state = createInitialState()
		state.notifications = [
			{ type: "error", message: "Error", id: "1" },
			{ type: "success", message: "Success", id: "2" }
		]

		const newState = actions.clearNotifications(state)

		expect(newState.notifications).toHaveLength(0)
	})
})

const mockModal = {
	id: "test-modal",
	title: "Test Modal",
	Content: () => "Test content"
}

describe("addModal", () => {
	it("should add modal to state", () => {
		const state = createInitialState()

		const newState = actions.addModal(state, { modal: mockModal })

		expect(newState.modals).toHaveLength(1)
		expect(newState.modals[0]).toEqual(mockModal)
	})

	it("should not add duplicate modal with same id", () => {
		const state = createInitialState()
		state.modals = [mockModal]

		const newState = actions.addModal(state, { modal: mockModal })

		expect(newState.modals).toHaveLength(1)
	})
})

describe("closeModal", () => {
	it("should remove modal by id", () => {
		const state = createInitialState()
		const modal2 = { ...mockModal, id: "modal-2", title: "Modal 2" }
		state.modals = [mockModal, modal2]

		const newState = actions.closeModal(state, { id: "test-modal" })

		expect(newState.modals, "one modal remains").toHaveLength(1)
		expect(newState.modals[0]?.id, "remaining modal is modal-2").toBe("modal-2")
	})

	it("should handle non-existent modal id", () => {
		const state = createInitialState()
		state.modals = [mockModal]

		const newState = actions.closeModal(state, { id: "non-existent" })

		expect(newState.modals).toHaveLength(1)
	})
})
