import { describe, expect, it } from "bun:test"
import { appStateActionsInternal as actions } from "./actions"
import type { TrackId } from "../database/types"
import type { AppState, Queue } from "./types"

describe("stopPlayback", () => {
	it("should reset playback state to initial values", () => {
		// Given a state with active playback
		const state = createInitialState()
		state.playback.queue = createMockQueue()
		state.playback.index = 2
		state.playback.manuallyAdded = trackIds("track-1", "track-2")
		state.playback.playState = "playing"
		state.playback.progress = 45
		state.playback.shuffleMap = [0, 2, 1, 4, 3]

		// When stopPlayback is called
		const newState = actions.stopPlayback(state)

		// Then playback should be reset
		expect(newState.playback.queue).toBeUndefined()
		expect(newState.playback.index).toBe(0)
		expect(newState.playback.manuallyAdded).toEqual([])
		expect(newState.playback.playState).toBe("stopped")
		expect(newState.playback.progress).toBe(0)
		expect(newState.playback.shuffleMap).toEqual([])
	})
})

describe("playNewPlayback", () => {
	it("should set new queue and start playing without shuffle", () => {
		const state = createInitialState()
		const queue = createMockQueue()

		const newState = actions.playNewPlayback(state, { queue, index: 2 })

		expect(newState.playback.queue).toEqual(queue)
		expect(newState.playback.index).toBe(2)
		expect(newState.playback.playState).toBe("playing")
		expect(newState.playback.isPlayingFromManualQueue).toBe(false)
	})

	it("should set new queue with default index 0", () => {
		const state = createInitialState()
		const queue = createMockQueue()

		const newState = actions.playNewPlayback(state, { queue })

		expect(newState.playback.index).toBe(0)
	})

	it("should shuffle tracks when shuffleMap is active", () => {
		const state = createInitialState()
		state.playback.shuffleMap = [] // Indicates shuffle is on
		const queue = createMockQueue(3)

		const newState = actions.playNewPlayback(state, { queue, index: 1 })

		expect(newState.playback.queue?.tracks).toHaveLength(3)
		expect(newState.playback.shuffleMap).toHaveLength(3)
		expect(newState.playback.queue?.source).toEqual(queue.source)
	})
})

describe("playFromManualQueue", () => {
	it("should start playing from manual queue at given index", () => {
		const state = createInitialState()
		const added = trackIds("track-1", "track-2", "track-3")

		state.playback.manuallyAdded = added

		const newState = actions.playFromManualQueue(state, { index: 0 })

		expect(newState.playback.isPlayingFromManualQueue).toBe(true)
		expect(newState.playback.playState).toBe("playing")
		expect(newState.playback.manuallyAdded).toEqual(added)
	})

	it("should slice manual queue when index > 0", () => {
		const state = createInitialState()
		state.playback.manuallyAdded = trackIds("1", "2", "3")

		const newState = actions.playFromManualQueue(state, { index: 1 })

		expect(newState.playback.manuallyAdded).toEqual(trackIds("2", "3"))
	})

	it("should not modify state when index is out of bounds", () => {
		const state = createInitialState()
		state.playback.manuallyAdded = trackIds("1")

		const newState = actions.playFromManualQueue(state, { index: 5 })

		// State should remain unchanged (except for any side effects from addErrorNotification)
		expect(newState.playback.isPlayingFromManualQueue).toBe(false)
	})
})

describe("playIndex", () => {
	it("should set playback index and start playing", () => {
		const state = createInitialState()
		state.playback.queue = createMockQueue()

		const newState = actions.playIndex(state, { index: 3 })

		expect(newState.playback.index).toBe(3)
		expect(newState.playback.playState).toBe("playing")
		expect(newState.playback.isPlayingFromManualQueue).toBe(false)
	})

	it("should handle index out of bounds gracefully", () => {
		const state = createInitialState()
		state.playback.queue = createMockQueue(3) // Only 3 tracks

		const newState = actions.playIndex(state, { index: 5 })

		// Should not crash and handle error appropriately
		expect(newState.playback.playState).toBe("playing")
	})

	it("should handle no queue gracefully", () => {
		const state = createInitialState()
		// No queue set

		const newState = actions.playIndex(state, { index: 0 })

		expect(newState.playback.playState).toBe("playing")
	})
})

describe("nextTrack", () => {
	it("should advance to next track", () => {
		const state = createInitialState()
		state.playback.queue = createMockQueue()
		state.playback.index = 1

		const newState = actions.nextTrack(state)

		expect(newState.playback.index).toBe(2)
	})

	it("should loop to beginning when at end with loop_queue", () => {
		const state = createInitialState()
		state.playback.queue = createMockQueue(3)
		state.playback.index = 2 // Last track
		state.playback.loopState = "loop_queue"

		const newState = actions.nextTrack(state)

		expect(newState.playback.index).toBe(0)
	})

	it("should not change when no queue exists", () => {
		const state = createInitialState()
		// No queue

		const newState = actions.nextTrack(state)

		expect(newState.playback.index).toBe(0)
	})
})

describe("previousTrack", () => {
	it("should go to previous track", () => {
		const state = createInitialState()
		state.playback.queue = createMockQueue()
		state.playback.index = 2

		const newState = actions.previousTrack(state)

		expect(newState.playback.index).toBe(1)
	})

	it("should loop to end when at beginning with loop_queue", () => {
		const state = createInitialState()
		state.playback.queue = createMockQueue(5)
		state.playback.index = 0
		state.playback.loopState = "loop_queue"

		const newState = actions.previousTrack(state)

		expect(newState.playback.index).toBe(4) // Last track
	})
})

describe("togglePlayback", () => {
	it("should pause when playing", () => {
		const state = createInitialState()
		state.playback.queue = createMockQueue()
		state.playback.playState = "playing"

		const newState = actions.togglePlayback(state)

		expect(newState.playback.playState).toBe("paused")
	})

	it("should play when paused", () => {
		const state = createInitialState()
		state.playback.queue = createMockQueue()
		state.playback.playState = "paused"

		const newState = actions.togglePlayback(state)

		expect(newState.playback.playState).toBe("playing")
	})

	it("should not change state when no queue", () => {
		const state = createInitialState()
		state.playback.playState = "stopped"

		const newState = actions.togglePlayback(state)

		expect(newState.playback.playState).toBe("stopped")
	})
})

describe("setPlayProgress", () => {
	it("should update progress time", () => {
		const state = createInitialState()

		const newState = actions.setPlayProgress(state, { newTime: 123.45 })

		expect(newState.playback.progress).toBe(123.45)
	})
})

describe("toggleShuffle", () => {
	it("should enable shuffle when disabled", () => {
		const state = createInitialState()
		state.playback.queue = createMockQueue(4)
		state.playback.index = 1

		const newState = actions.toggleShuffle(state)

		expect(newState.playback.shuffleMap).toBeDefined()
		expect(newState.playback.shuffleMap).toHaveLength(4)
	})

	it("should disable shuffle when enabled", () => {
		const state = createInitialState()
		state.playback.queue = createMockQueue(4)
		state.playback.shuffleMap = [2, 0, 3, 1]
		state.playback.index = 2 // Index in shuffled array

		const newState = actions.toggleShuffle(state)

		expect(newState.playback.shuffleMap).toBeUndefined()
		expect(newState.playback.index).toBe(3) // Mapped back to original position
	})

	it("should handle no queue with shuffle toggle", () => {
		const state = createInitialState()
		state.playback.shuffleMap = undefined

		const newState = actions.toggleShuffle(state)

		expect(newState.playback.shuffleMap).toEqual([])
	})
})

describe("addToManualQueueFirst", () => {
	it("should add track to beginning of manual queue", () => {
		const given = trackIds("1")
		const toAdd = trackId("2")
		const expected = trackIds("2", "1")

		const state = createInitialState({ manuallyAdded: given })

		const newState = actions.addToManualQueueFirst(state, {
			trackId: toAdd
		})

		expect(newState.playback.manuallyAdded).toEqual(expected)
	})
})

describe("addToManualQueueLast", () => {
	it("should add track to end of manual queue", () => {
		const state = createInitialState()
		state.playback.manuallyAdded = trackIds("track-1")

		const newState = actions.addToManualQueueLast(state, {
			trackId: "track-2" as TrackId
		})

		expect(newState.playback.manuallyAdded).toEqual(
			trackIds("track-1", "track-2")
		)
	})
})

describe("removeFromManualQueue", () => {
	it("should remove track at given index", () => {
		const given = trackIdsRange(3)
		const toRemove = 1
		const expected = [given[0]!, given[2]!]

		const state = createInitialState({ manuallyAdded: given })

		const newState = actions.removeFromManualQueue(state, { index: toRemove })

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
			parameter: { id: "album-1" as any }
		}

		const newState = actions.navigateTo(state, { goTo: newPage })

		expect(newState.view.history).toHaveLength(2)
		expect(newState.view.history[1]).toEqual(newPage)
		expect(newState.view.historyIndex).toBe(1)
	})

	it("should not navigate to same page", () => {
		const state = createInitialState()
		const currentPage = { route: "home" as const }

		const newState = actions.navigateTo(state, { goTo: currentPage })

		expect(newState.view.history).toHaveLength(1)
		expect(newState.view.historyIndex).toBe(0)
	})

	it("should replace forward history when navigating from middle", () => {
		const state = createInitialState()
		// Simulate having forward history
		state.view.history = [
			{ route: "home" },
			{ route: "album", parameter: { id: "album-1" as any } },
			{ route: "artist", parameter: { id: "artist-1" as any } }
		]
		state.view.historyIndex = 1

		const newPage = {
			route: "playlist" as const,
			parameter: { id: "playlist-1" as any }
		}
		const newState = actions.navigateTo(state, { goTo: newPage })

		expect(newState.view.history).toHaveLength(3)
		expect(newState.view.history[2]).toEqual(newPage)
		expect(newState.view.historyIndex).toBe(2)
	})
})

describe("navigateBack", () => {
	it("should go back in history", () => {
		const state = createInitialState()
		state.view.history = [
			{ route: "home" },
			{ route: "album", parameter: { id: "album-1" as any } }
		]
		state.view.historyIndex = 1

		const newState = actions.navigateBack(state)

		expect(newState.view.historyIndex).toBe(0)
	})

	it("should not go back when at beginning", () => {
		const state = createInitialState()

		const newState = actions.navigateBack(state)

		expect(newState.view.historyIndex).toBe(0)
	})
})

describe("navigateForward", () => {
	it("should go forward in history", () => {
		const state = createInitialState()
		state.view.history = [
			{ route: "home" },
			{ route: "album", parameter: { id: "album-1" as any } }
		]
		state.view.historyIndex = 0

		const newState = actions.navigateForward(state)

		expect(newState.view.historyIndex).toBe(1)
	})

	it("should not go forward when at end", () => {
		const state = createInitialState()

		const newState = actions.navigateForward(state)

		expect(newState.view.historyIndex).toBe(0)
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

		expect(newState.notifications).toHaveLength(1)
		expect(newState.notifications[0]).toEqual(notification)
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

		expect(newState.modals).toHaveLength(1)
		expect(newState.modals[0]?.id).toBe("modal-2")
	})

	it("should handle non-existent modal id", () => {
		const state = createInitialState()
		state.modals = [mockModal]

		const newState = actions.closeModal(state, { id: "non-existent" })

		expect(newState.modals).toHaveLength(1)
	})
})

function createInitialState(options?: {
	tracks?: readonly TrackId[]
	manuallyAdded?: readonly TrackId[]
}): AppState {
	const tracks = options?.tracks
	const manuallyAdded = options?.manuallyAdded

	return {
		playback: {
			queue: tracks ? { source: { type: "all" }, tracks } : undefined,
			manuallyAdded: manuallyAdded ?? [],
			index: 0,
			playState: "stopped",
			loopState: "none",
			shuffleMap: undefined,
			isPlayingFromManualQueue: false,
			progress: 0
		},
		view: {
			historyIndex: 0,
			history: [{ route: "home" }]
		},
		notifications: [],
		modals: [],
		focusedInputs: []
	}
}

function createMockQueue(trackCount = 5): Queue {
	return {
		tracks: trackIdsRange(trackCount),
		source: { type: "all" }
	}
}

function trackIdsRange(amount: number): TrackId[] {
	return Array.from({ length: amount }, (_, i) => trackId(`track-${i}`))
}

function trackIds(...names: string[]): TrackId[] {
	return names as TrackId[]
}

function trackId(name: string): TrackId {
	return name as TrackId
}
