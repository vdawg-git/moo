import { createStore } from "@xstate/store"
import { Observable, shareReplay } from "rxjs"
import { appStateActionsInternal as a } from "./actions"
import type { AppState } from "./types"

export function createAppState() {
	const appState = createStore({
		context: createInitalState(),
		on: {
			playNewPlayback: a.playNewPlayback,
			playIndex: a.playIndex,
			stopPlayback: a.stopPlayback,
			nextTrack: a.nextTrack,
			previousTrack: a.previousTrack,
			togglePlayback: a.togglePlayback,
			resumePlayback: a.resumePlayback,
			pausePlayback: a.pausePlayback,
			toggleShuffle: a.toggleShuffle,
			removeFromQueue: a.removeFromQueue,

			playFromManualQueue: a.playFromManualQueue,
			addToManualQueueFirst: a.addToManualQueueFirst,
			addToManualQueueLast: a.addToManualQueueLast,
			removeFromManualQueue: a.removeFromManualQueue,

			addNotification: a.addNotification,
			clearNotifications: a.clearNotifications,

			navigateTo: a.navigateTo,
			navigateBack: a.navigateBack,
			navigateForward: a.navigateForward,
			goBackOrHome: a.goBackOrHome,

			addModal: a.addModal,
			closeModal: a.closeModal,

			addCapturedInput: a.addCapturedInput,
			removeCapturedInput: a.removeCapturedInput,
			registerZone: a.registerZone,
			unregisterZone: a.unregisterZone
		} satisfies { [K in keyof typeof a]: (typeof a)[K] }
	})

	const appState$ = new Observable<AppState>((subscriber) => {
		const subscription = appState.subscribe((snapshot) =>
			subscriber.next(snapshot.context)
		)

		return () => subscription.unsubscribe()
	}).pipe(shareReplay({ refCount: false, bufferSize: 1 }))

	return { appState, appState$ }
}

export type AppStore = ReturnType<typeof createAppState>["appState"]

function createInitalState(): AppState {
	return {
		playback: {
			queue: undefined,
			manuallyAdded: [],
			index: 0,
			playState: "stopped",
			loopState: "none",
			shuffleMap: undefined,
			isPlayingFromManualQueue: false
		},
		view: {
			historyIndex: 0,
			history: [{ route: "home" }]
		},
		notifications: [],
		modals: [],
		inputsCaptured: [],
		activeZones: []
	}
}
