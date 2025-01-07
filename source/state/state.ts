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
			currentPage: {
				type: "home",
			},
		},
	}
}

interface StoreContext {
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
		currentPage: ViewPage
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

type ViewPage =
	| {
			// the homeview should be configurable via the config
			type: "home"
	  }
	| {
			type: "playlist"
			playlistId: string
	  }
	| {
			type: "search"
	  }
