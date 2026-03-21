import type { TrackData, TrackId } from "#/ports/database"
import type { AppState, Queue } from "#/core/state/types"
import type { LoopState, PlayingState } from "#/shared/types/types"

type CreateStateOptions = {
	readonly tracks?: readonly TrackId[]
	readonly manuallyAdded?: readonly TrackId[]
	readonly index?: number
	readonly playState?: PlayingState
	readonly loopState?: LoopState
	readonly shuffleMap?: readonly number[]
	readonly isPlayingFromManualQueue?: boolean
	readonly progress?: number
}

export function createInitialState(options?: CreateStateOptions): AppState {
	const tracks = options?.tracks

	return {
		playback: {
			queue: tracks ? { source: { type: "all" }, tracks } : undefined,
			manuallyAdded: options?.manuallyAdded ?? [],
			index: options?.index ?? 0,
			playState: options?.playState ?? "stopped",
			loopState: options?.loopState ?? "none",
			shuffleMap: options?.shuffleMap,
			isPlayingFromManualQueue: options?.isPlayingFromManualQueue ?? false,
			progress: options?.progress ?? 0
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

export function mockTrackData(id: string): TrackData {
	return {
		id: id as TrackId,
		sourceProvider: "local",
		duration: 180,
		title: `Track ${id}`,
		artist: "Test Artist",
		album: "Test Album",
		mtime: Date.now(),
		size: 1024
	} as TrackData
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
