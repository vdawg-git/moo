import { createStore, createStoreWithProducer } from "@xstate/store"
import type { Track } from "../database/types"
import type { LoopState, PlayingState } from "../types/types"
import type { ReactNode } from "react"
import type { Except } from "type-fest"
import { produce } from "immer"
import { deepEquals } from "bun"

export const state = createStoreWithProducer(produce, {
	context: createInitalState(),
	on: {
		navigateTo: (context, goTo: ViewPage) => {
			const index = context.view.historyIndex
			const currentView = context.view.history[index]
			if (deepEquals(currentView, goTo)) return

			context.view.history.splice(index, Number.POSITIVE_INFINITY, goTo)
			context.view.historyIndex += 1
		},
		navigateBack: (context) => {
			if (context.view.historyIndex <= 0) return
			context.view.historyIndex -= 1
		},
		navigateForward: (context) => {
			if (context.view.historyIndex + 1 >= context.view.history.length) return
			context.view.historyIndex += 1
		},
	},
})

function createInitalState(): AppState {
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
		modals: [],
	}
}

export interface AppState {
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
	modals: ReactNode[]
}

type Notification = {
	type: "error" | "success" | "default"
	/** The message to display. Can be JSX. */
	message: ReactNode
	id: string
}
type NotificationAdd = Except<Notification, "id">

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
