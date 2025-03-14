import { randomUUID } from "node:crypto"
import { createStoreWithProducer } from "@xstate/store"
import { deepEquals } from "bun"
import { produce } from "immer"
import type { ReactNode } from "react"
import { Observable, shareReplay } from "rxjs"
import { match } from "ts-pattern"
import type { Except } from "type-fest"
import { Result } from "typescript-result"
import { database } from "#/database/database"
import { enumarateError, logg } from "#/logs"
import type { BaseTrack, PlaylistId, Track } from "../database/types"
import type { LoopState, PlayingState } from "../types/types"

export interface AppState {
	playback: {
		/**
		 * The tracks to play.
		 * Does not include the manuallyAdded ones.
		 */
		queue: Queue | undefined
		/**
		 * Tracks to play next.
		 * Those are manually added by the user via "Play next" or similliar.
		 */
		manuallyAdded: Track[]
		index: number
		playState: PlayingState
		loopState: LoopState
		isShuffling: boolean
		isPlayingFromManualQueue: boolean
		/** Time in seconds */
		progress: number
	}

	/** This dictates the navigation */
	view: {
		historyIndex: number
		history: ViewPage[]
	}

	notifications: AppNotification[]
	modals: AppModal[]
	/**
	 * Wether the {@linkcode KeybindingsManager} should stop listening to input.
	 * Used to disable it when a textinput or the runner is focused
	 */
	disableGlobalKeybinds: boolean
}

export const appState = createStoreWithProducer(produce, {
	context: createInitalState(),
	on: {
		// playback

		stopPlayback: (context) => {
			context.playback.queue = undefined
			context.playback.index = 0
			context.playback.manuallyAdded = []
			context.playback.playState = "stopped"
			context.playback.progress = 0
		},

		playNewPlayback: (
			context,
			{ queue, index = 0 }: { queue: Queue; index?: number }
		) => {
			context.playback.isPlayingFromManualQueue = false
			context.playback.index = index
			context.playback.playState = "playing"
			context.playback.queue = queue

			if (context.playback.isPlayingFromManualQueue) {
				context.playback.manuallyAdded.shift()
			}
		},

		nextTrack: (context) => {
			if (!context.playback.queue) return

			// TODO add manuallyAdded handling
			// should switch to manuallyAdded if there is manually added stuff,
			// should shift from manuallyAdded if already playing from manually added

			const loop = context.playback.loopState

			const currentIndex = context.playback.index
			const overLastTrack =
				currentIndex + 1 === context.playback.queue.tracks.length

			if (overLastTrack) {
				if (loop === "loop_queue") {
					context.playback.index = 0
				} else {
					context.playback.playState === "stopped"
				}
				return
			}

			context.playback.index += 1
		},

		previousTrack: (context) => {
			if (!context.playback.queue) return

			const loop = context.playback.loopState

			const currentIndex = context.playback.index
			const overLastTrack = currentIndex - 1 <= 0

			if (overLastTrack) {
				if (loop === "loop_queue") {
					context.playback.index = context.playback.queue.tracks.length - 1
				} else {
					context.playback.playState === "stopped"
				}
				return
			}

			context.playback.index -= 1
		},

		togglePlayback: (context) => {
			const playState = context.playback.playState

			if (!context.playback.queue) return

			context.playback.playState =
				playState === "playing" ? "paused" : "playing"
		},

		setPlayProgress: (context, { newTime }: { newTime: number }) => {
			context.playback.progress = newTime
		},

		// notifications

		addNotification: (
			context,
			{ notification }: { notification: AppNotification }
		) => {
			context.notifications.push(notification)
		},

		clearNotifications: (context) => {
			context.notifications = []
		},

		disableGlobalKeybinds: (context, { disabled }: { disabled: boolean }) => {
			context.disableGlobalKeybinds = disabled
		},

		// navigation

		navigateTo: (context, { goTo }: { goTo: ViewPage }) => {
			const index = context.view.historyIndex
			const currentView = context.view.history[index]
			if (deepEquals(currentView, goTo)) return

			context.view.history.splice(index + 1, Number.POSITIVE_INFINITY)
			context.view.history.push(goTo)
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

		// Modals

		addModal: (context, { modal }: { modal: AppModal }) => {
			if (context.modals.find(({ id }) => modal.id === id)) {
				return
			}

			context.modals.push(modal)
		},

		closeModal: (context, { id }: { id: AppModal["id"] }) => {
			context.modals = context.modals.filter(
				({ id: toClose }) => id !== toClose
			)
		}
	}
})

function createInitalState(): AppState {
	return {
		playback: {
			queue: undefined,
			manuallyAdded: [],
			index: 0,
			playState: "stopped",
			loopState: "none",
			isShuffling: false,
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

/**
 * A modal in the {@link appState}.
 * Does hold its content and its ID.
 */
export type AppModal = Readonly<{
	/**
	 * The content to show to the user.
	 * The ModalManager shows it to the user via a modal.
	 * */
	Content: (props: AppModalContentProps) => ReactNode

	/** Unique ID to discern the different modals */
	id: number | string

	/** The titel to show on the top of the modal box */
	title: string
}>
export type AppModalContentProps = {
	/** Removes the current modal */
	closeModal: () => void
	changeTitle: (title: string) => void
}

/** A notification in Moo */
export type AppNotification = {
	type: "error" | "success" | "default" | "warn"
	/** The message to display. Can be JSX. */
	message: ReactNode
	/** Unique ID */
	id: string
}
type NotificationAdd = Except<AppNotification, "id">

type Queue = {
	tracks: readonly BaseTrack[]
	source: PlaybackSource
}

/**
 * Specifies the source of a playback.
 * Can be a playlist, an album etc.
 */
export type PlaybackSource =
	| {
			// currently we only support playlists,
			// but in the future albums, artists, etc. should work too
			// and they should be compatible with streaming services too
			type: "playlist"
			id: PlaylistId
			// provider: "local"
	  }
	| {
			/** Everything from the library */
			type: "all"
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
	playlist: { id: PlaylistId }
	search: undefined
}

export type ViewPage = {
	[Route in keyof ViewPages]: ViewPages[Route] extends undefined
		? { route: Route; parameter?: undefined }
		: { route: Route; parameter: ViewPages[Route] }
}[keyof ViewPages]

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
}: { source: PlaybackSource; index?: number }) {
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
				queue: { tracks, source },
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
