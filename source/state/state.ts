import { createStore } from "@xstate/store"
import type { Track } from "../database/types"
import type { LoopState, PlayingState } from "../types/types"

export const state = createStore({
	context: createInitalState(),
	on: {},
})

function createInitalState(): StoreContext {
	return {
		playback: {
			queue: undefined,
			manuallyAdded: [],
			index: 0,
			playState: "paused",
			loopState: "none",
			isShuffling: false,
			isPlayingFromManualQueue: false,
		},
		view: {
			historyIndex: 0,
			history: [{ route: "home" }],
		},
		notifications: [],
	}
}

export interface StoreContext {
	playback: {
		queue: Queue | undefined
		manuallyAdded: Track[]
		index: number
		playState: PlayingState
		loopState: LoopState
		isShuffling: boolean
		isPlayingFromManualQueue: boolean
	}

	/** This dictates the navigation */
	view: {
		historyIndex: number
		history: ViewPage[]
	}

	notifications: Notification[]
}

type Notification = {
	type: "error" | "success" | "default"
	message: string
}
type Queue = {
	tracks: Track[]
	source:
		| {
				// currently we only support playlists,
				// but in the future albums, artists, etc. should work too
				// and they should be compatible with streaming services too
				type: "playlist"
				id: string
				// provider: "local"
		  }
		| { type: "all" }
}

/**
 * This dictates the navigation
 * Each key is a route. The value is the data that is passed to the page
 * */
// We use an interface because it is extensible (for plugins),
// and it is easier to make a union type of the keys than making
// an interface out of an union type
export interface ViewPages {
	// the homeview should be configurable via the config
	home: undefined
	playlist: { id: string }
	search: undefined
}

export type ViewPage = {
	[Route in keyof ViewPages]: ViewPages[Route] extends undefined
		? { route: Route; parameter?: undefined }
		: { route: Route; parameter: ViewPages[Route] }
}[keyof ViewPages]
