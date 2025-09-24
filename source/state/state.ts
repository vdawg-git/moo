import { randomUUID } from "node:crypto"
import { createStore } from "@xstate/store"
import { Observable, shareReplay } from "rxjs"
import { match } from "ts-pattern"
import { Result } from "typescript-result"
import { database } from "#/database/database"
import { enumarateError, logg } from "#/logs"
import type { BaseTrack } from "../database/types"
import type { AppState, NotificationAdd, PlaybackSource } from "./types"
import { appStateActionsInternal as a } from "./actions"

/**
 * The global app state which holds data for
 * - navigation
 * - playback
 * - notifications
 * - modals
 * - and more...
 */
export const appState = createStore({
	context: createInitalState(),
	on: {
		////////////////////////
		// playback
		////////////////////////

		playNewPlayback: a.playNewPlayback,
		playIndex: a.playIndex,
		stopPlayback: a.stopPlayback,
		nextTrack: a.nextTrack,
		previousTrack: a.previousTrack,
		togglePlayback: a.togglePlayback,
		setPlayProgress: a.setPlayProgress,
		toggleShuffle: a.toggleShuffle,
		removeFromQueue: a.removeFromQueue,

		playFromManualQueue: a.playFromManualQueue,
		addToManualQueueFirst: a.addToManualQueueFirst,
		addToManualQueueLast: a.addToManualQueueLast,
		removeFromManualQueue: a.removeFromManualQueue,

		////////////////////////
		// notifications
		////////////////////////

		addNotification: a.addNotification,
		clearNotifications: a.clearNotifications,
		disableGlobalKeybinds: a.disableGlobalKeybinds,

		////////////////////////
		// navigation
		////////////////////////

		navigateTo: a.navigateTo,
		navigateBack: a.navigateBack,
		navigateForward: a.navigateForward,

		////////////////////////
		// Modals
		////////////////////////

		addModal: a.addModal,
		closeModal: a.closeModal
	} satisfies { [K in keyof typeof a]: (typeof a)[K] }
})

function createInitalState(): AppState {
	return {
		playback: {
			queue: undefined,
			manuallyAdded: [],
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
		disableGlobalKeybinds: false
	}
}

export function addErrorNotification(
	message: string,
	error?: Error | unknown,
	/** Tag to be used for the logs */
	tag?: string
) {
	const logableError =
		error instanceof Error ? enumarateError(error) : { error }

	logg.error(tag ?? message, {
		...logableError,
		...(!tag && { msg: message })
	})
	addNotification({ message, type: "error" })
}

export function addNotification(notification: NotificationAdd) {
	const id = randomUUID()
	appState.send({
		type: "addNotification",
		notification: { ...notification, id }
	})
	return id
}

export async function playNewPlayback({
	source,
	index
}: {
	source: PlaybackSource
	index?: number
}) {
	const state = appState.getSnapshot().context.playback

	const isSamePlayback =
		index === state.index && source.type === state.queue?.source.type
	if (isSamePlayback) {
		appState.send({ type: "togglePlayback" })
		return
	}

	const data = await fetchPlaybackSource(source)

	data
		.onSuccess((tracks) => {
			appState.send({
				type: "playNewPlayback",
				queue: { tracks: tracks.map(({ id }) => id), source },
				index
			})
		})
		.onFailure((error) => {
			addErrorNotification("Failed to start new playback", error)
		})
}

async function fetchPlaybackSource(
	source: PlaybackSource
): Promise<Result<readonly BaseTrack[], Error>> {
	return match(source)
		.with({ type: "all" }, () => database.getTracks())

		.with({ type: "playlist" }, ({ id }) =>
			database
				.getPlaylist(id)
				.then((response) =>
					response.map(
						(playlist) =>
							playlist?.tracks ?? Result.error(new Error("Playlist not found"))
					)
				)
		)
		.exhaustive()
}

/**
 * The appstate as an observable with `shareReplay`.
 */
export const appState$: Observable<AppState> = new Observable<AppState>(
	(subscriber) => {
		const subscription = appState.subscribe((snapshot) =>
			subscriber.next(snapshot.context)
		)

		return () => subscription.unsubscribe()
	}
).pipe(shareReplay())
