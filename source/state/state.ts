import { randomUUID } from "node:crypto"
import { createStore } from "@xstate/store"
import { Observable, shareReplay } from "rxjs"
import { match } from "ts-pattern"
import { Result } from "typescript-result"
import { logger } from "#/logs"
import { appStateActionsInternal as a } from "./actions"
import type { AppDatabase, BaseTrack } from "../database/types"
import type { ErrorNotificationFn } from "../types/types"
import type { AppState, NotificationAdd, PlaybackSource } from "./types"

export function createAppState() {
	const appState = createStore({
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
			resumePlayback: a.resumePlayback,
			pausePlayback: a.pausePlayback,
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

			////////////////////////
			// navigation
			////////////////////////

			navigateTo: a.navigateTo,
			navigateBack: a.navigateBack,
			navigateForward: a.navigateForward,
			goBackOrHome: a.goBackOrHome,

			////////////////////////
			// Modals
			////////////////////////

			addModal: a.addModal,
			closeModal: a.closeModal,

			////////////////////////
			// Keybindings
			////////////////////////

			addFocusedInput: a.addFocusedInput,
			removeFocusedInput: a.removeFocusedInput,
			registerKeybindingWhen: a.registerKeybindingWhen,
			unregisterKeybindWhen: a.unregisterKeybindWhen
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

export function createNotificationHelpers({
	appState
}: {
	readonly appState: AppStore
}) {
	function addNotification(notification: NotificationAdd): string {
		const id = randomUUID()
		appState.send({
			type: "addNotification",
			notification: { ...notification, id }
		})

		return id
	}

	function addErrorNotification(
		message: string,
		error?: unknown,
		/** Tag to be used for the logs */
		tag?: string
	) {
		logger.error(tag ? `${tag}: ${message}` : message, error)
		addNotification({ message, type: "error" })
	}

	return { addNotification, addErrorNotification }
}

export function createPlaybackActions({
	database,
	appState,
	addErrorNotification
}: {
	readonly database: AppDatabase
	readonly appState: AppStore
	readonly addErrorNotification: ErrorNotificationFn
}) {
	async function playNewPlayback({
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

	function fetchPlaybackSource(
		source: PlaybackSource
	): Promise<Result<readonly BaseTrack[], Error>> {
		return match(source)
			.returnType<Promise<Result<readonly BaseTrack[], Error>>>()

			.with({ type: "all" }, () => database.getTracks())

			.with({ type: "playlist" }, ({ id }) =>
				database
					.getPlaylist(id)
					.then((response) =>
						response.map(
							(playlist) =>
								playlist?.tracks
								?? Result.error(new Error("Playlist not found"))
						)
					)
			)

			.with({ type: "album" }, ({ id }) =>
				database
					.getAlbum(id)
					.map((album) =>
						album
							? album.tracks
							: Result.error(new Error(`Album not found: ${id}`))
					)
			)

			.with({ type: "artist" }, ({ id }) =>
				database
					.getArtist(id)
					.map((artist) =>
						artist
							? artist.tracks
							: Result.error(new Error(`Artist not found: ${id}`))
					)
			)

			.exhaustive()
	}

	return { playNewPlayback }
}

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
		focusedInputs: [],
		keybindingWhen: []
	}
}
