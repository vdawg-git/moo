import { randomUUID } from "node:crypto"
import { deepEquals } from "bun"
import { makeCreator } from "mutative"
import { IS_DEV } from "#/shared/constants"
import { shuffleWithMap, unshuffleFromMap } from "#/shared/helpers"
import { logger } from "#/shared/logs"
import type { TrackId } from "#/shared/types/brandedIds"
import type { Draft } from "mutative"
import type {
	AppModal,
	AppNotification,
	AppState,
	Queue,
	ViewPage,
	ZoneRegistered
} from "./types"

const create = makeCreator({ strict: IS_DEV, enableAutoFreeze: IS_DEV })

/**
 * Creates an action using a producer.
 *
 * We use `mutative` which is a faster `immer` alternative
 */
function createAction(
	mutate: (state: Draft<AppState>) => void
): (context: AppState) => AppState

function createAction<TPayload>(
	mutate: (state: Draft<AppState>, event: TPayload) => void
): (context: AppState, event: TPayload) => AppState

function createAction<TPayload = never>(
	mutate:
		| ((state: Draft<AppState>) => void)
		| ((state: Draft<AppState>, event: TPayload) => void)
): (context: AppState, event: TPayload) => AppState {
	return (context: AppState, event: TPayload) =>
		create(context, (draft) => mutate(draft, event))
}

// playback

const stopPlayback = createAction((context) => {
	context.playback.queue = undefined
	context.playback.index = 0
	context.playback.manuallyAdded = []
	context.playback.playState = "stopped"
	context.playback.shuffleMap = context.playback.shuffleMap ? [] : undefined
})

const playNewPlayback = createAction<{ queue: Queue; index?: number }>(
	(context, { queue, index = 0 }) => {
		if (context.playback.shuffleMap) {
			const { tracks } = queue
			const { shuffled, shuffleMap } = shuffleWithMap(tracks)
			context.playback.shuffleMap = shuffleMap
			context.playback.index = shuffleMap.indexOf(index)
			context.playback.queue = { tracks: shuffled, source: queue.source }
		} else {
			context.playback.index = index
			context.playback.queue = queue as Draft<Queue>
		}

		context.playback.isPlayingFromManualQueue = false
		context.playback.playState = "playing"
	}
)

const playFromManualQueue = createAction<{ index: number }>(
	(state, { index }) => {
		const { manuallyAdded } = state.playback

		if (index > manuallyAdded.length - 1) {
			state.notifications.push(
				createErrorNotification("Bug. Index is out of bounds #8764")
			)
			return
		}

		state.playback.isPlayingFromManualQueue = true
		state.playback.playState = "playing"

		if (index > 0) {
			state.playback.manuallyAdded = manuallyAdded.slice(index)
		}
		logger.debug("playFromManualQueue", { state: manuallyAdded })
	}
)

const playIndex = createAction<{ index: number }>((state, { index }) => {
	state.playback.isPlayingFromManualQueue = false
	state.playback.playState = "playing"
	const tracksLength = state.playback.queue?.tracks.length ?? 0

	if (index >= tracksLength) {
		logger.error("playIndex index out of bounds", { index, tracksLength })
		state.notifications.push(
			createErrorNotification("Bug happened when playing")
		)
	} else {
		state.playback.index = index
	}
})

const nextTrack = createAction((context) => {
	if (!context.playback.queue) return

	if (context.playback.isPlayingFromManualQueue) {
		context.playback.manuallyAdded.shift()

		if (context.playback.manuallyAdded.length > 0) return

		context.playback.isPlayingFromManualQueue = false
	}

	if (context.playback.manuallyAdded.length > 0) {
		context.playback.isPlayingFromManualQueue = true

		return
	}

	const loop = context.playback.loopState

	const currentIndex = context.playback.index
	const overLastTrack = currentIndex + 1 >= context.playback.queue.tracks.length

	if (overLastTrack) {
		if (loop === "loop_queue") {
			context.playback.index = 0
		} else {
			context.playback.playState = "stopped"
		}

		return
	}

	context.playback.index += 1
})

const previousTrack = createAction((context) => {
	if (!context.playback.queue) return

	if (context.playback.isPlayingFromManualQueue) {
		context.playback.isPlayingFromManualQueue = false
		context.playback.manuallyAdded.shift()

		return
	}

	const loop = context.playback.loopState

	const currentIndex = context.playback.index
	const overLastTrack = currentIndex - 1 < 0

	if (overLastTrack) {
		if (loop === "loop_queue") {
			context.playback.index = context.playback.queue.tracks.length - 1
		} else {
			context.playback.playState = "stopped"
		}

		return
	}

	context.playback.index -= 1
})

const togglePlayback = createAction((context) => {
	const playState = context.playback.playState

	if (!context.playback.queue) return

	context.playback.playState = playState === "playing" ? "paused" : "playing"
})

const resumePlayback = createAction((context) => {
	if (!context.playback.queue) return

	context.playback.playState = "playing"
})

const pausePlayback = createAction((context) => {
	if (!context.playback.queue) return

	context.playback.playState = "paused"
})

const toggleShuffle = createAction((context) => {
	const { shuffleMap } = context.playback
	logger.debug("toggleShuffle", {
		shuffleMap,
		tracks: context.playback.queue?.tracks
	})

	if (!context.playback.queue) {
		context.playback.shuffleMap = shuffleMap ? undefined : []
		return
	}

	const tracks = context.playback.queue.tracks

	/* has shuffle on */
	if (shuffleMap) {
		context.playback.queue.tracks = unshuffleFromMap(tracks, shuffleMap)
		context.playback.index = shuffleMap[context.playback.index]!
		context.playback.shuffleMap = undefined
		/* has shuffle off */
	} else {
		const playIndex = context.playback.index
		const { shuffled, shuffleMap: newShuffleMap } = shuffleWithMap(tracks)
		context.playback.shuffleMap = newShuffleMap
		context.playback.queue.tracks = shuffled

		const newIndex = newShuffleMap.indexOf(playIndex)
		context.playback.index = newIndex
	}
})

const addToManualQueueFirst = createAction<{ trackId: TrackId }>(
	(context, { trackId }) => {
		context.playback.manuallyAdded.unshift(trackId)
	}
)
const addToManualQueueLast = createAction<{ trackId: TrackId }>(
	(context, { trackId }) => {
		context.playback.manuallyAdded.push(trackId)
	}
)
const removeFromManualQueue = createAction<{ index: number }>(
	(context, { index }) => {
		context.playback.manuallyAdded.splice(index, 1)
	}
)

/** Removes a single track from the auto queue */
const removeFromQueue = createAction<{ index: number }>((state, { index }) => {
	if (!state.playback.queue) {
		state.notifications.push(createErrorNotification("Bug. Queue is not set"))
		return
	}

	state.playback.queue.tracks.splice(index, 1)
})

// notifications

const addNotification = createAction<{ notification: AppNotification }>(
	(context, { notification }) => {
		context.notifications.push(notification)
	}
)

const clearNotifications = createAction((context) => {
	context.notifications = []
})

// navigation

const navigateTo = createAction<{ goTo: ViewPage }>((context, { goTo }) => {
	const index = context.view.historyIndex
	const currentView = context.view.history[index]
	if (deepEquals(currentView, goTo)) return

	context.view.history.splice(index + 1, Number.POSITIVE_INFINITY)
	context.view.history.push(goTo)
	context.view.historyIndex += 1
})

const navigateBack = createAction((context) => {
	if (context.view.historyIndex <= 0) return
	context.view.historyIndex -= 1
})

const goBackOrHome = createAction((context) => {
	const index = context.view.historyIndex
	const current = context.view.history[index]

	if (index <= 0 && current?.route !== "home") {
		context.view.history.push({ route: "home" })
		context.view.historyIndex = index + 1
		return
	}

	if (index <= 0) return

	context.view.historyIndex--
})

const navigateForward = createAction((context) => {
	if (context.view.historyIndex + 1 >= context.view.history.length) return
	context.view.historyIndex += 1
})

// Modals

const addModal = createAction<{ modal: AppModal }>((context, { modal }) => {
	if (context.modals.find(({ id }) => modal.id === id)) {
		logger.warn("Modal id already added", { id: modal.id, title: modal.title })
		return
	}

	context.modals.push(modal)
})

const closeModal = createAction<{ id: AppModal["id"] }>((context, { id }) => {
	context.modals = context.modals.filter(({ id: toClose }) => id !== toClose)
})

const addCapturedInput = createAction<{ id: string }>((context, { id }) => {
	context.inputsCaptured.push(id)
})
const removeCapturedInput = createAction<{ id: string }>((context, { id }) => {
	context.inputsCaptured = context.inputsCaptured.filter(
		(someId) => someId !== id
	)
})

const registerZone = createAction<{
	toRegister: ZoneRegistered
}>((context, { toRegister }) => {
	context.activeZones.push(toRegister)
})

const unregisterZone = createAction<{ id: string }>(
	(context, { id: toRemove }) => {
		context.activeZones = context.activeZones.filter(
			({ id }) => id !== toRemove
		)
	}
)

function createErrorNotification(message: string): AppNotification {
	logger.error("reducer error", { message })
	return { id: randomUUID(), message, type: "error" }
}

// Lets export the actions like that to avoid polluting LSP imports.
// Hopefully one day Typescript improves that..
export const appStateActionsInternal = {
	addCapturedInput,
	addModal,
	addNotification,
	addToManualQueueFirst,
	addToManualQueueLast,
	clearNotifications,
	closeModal,
	goBackOrHome,
	navigateBack,
	navigateForward,
	navigateTo,
	nextTrack,
	pausePlayback,
	playFromManualQueue,
	playIndex,
	playNewPlayback,
	previousTrack,
	registerZone,
	removeCapturedInput,
	removeFromManualQueue,
	removeFromQueue,
	resumePlayback,
	stopPlayback,
	togglePlayback,
	toggleShuffle,
	unregisterZone
}
