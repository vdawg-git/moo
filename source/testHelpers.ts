import type { TrackId } from "#/database/types"
import type { AppState, Queue } from "#/state/types"

export function createInitialState(options?: {
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
		focusedInputs: [],
		keybindingWhen: []
	}
}

export function createMockQueue(trackCount = 5): Queue {
	return {
		tracks: trackIdsRange(trackCount),
		source: { type: "all" }
	}
}

export function trackIdsRange(amount: number): TrackId[] {
	return Array.from({ length: amount }, (_, i) => trackId(`track-${i}`))
}

export function trackIds(...names: string[]): TrackId[] {
	return names as TrackId[]
}

export function trackId(name: string): TrackId {
	return name as TrackId
}
