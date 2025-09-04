import type { ReactNode } from "react"
import type { Except } from "type-fest"
import type { BaseTrack, PlaylistId, TrackId } from "../database/types"
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
		manuallyAdded: readonly TrackId[]
		index: number
		playState: PlayingState
		loopState: LoopState
		/**
		 * Is set if shuffling is on.
		 *
		 * This maps the indexes of each item to the new position.
		 * When shuffle gets unset, this is used to revert back to the original order.
		 */
		shuffleMap: readonly number[] | undefined
		isPlayingFromManualQueue: boolean
		/** Time in seconds */
		progress: number
	}

	/** This dictates the navigation */
	view: {
		historyIndex: number
		history: readonly ViewPage[]
	}

	notifications: readonly AppNotification[]
	modals: readonly AppModal[]
	/**
	 * Wether the {@linkcode KeybindingsManager} should stop listening to input.
	 * Used to disable it when a textinput or the runner is focused
	 */
	disableGlobalKeybinds: boolean
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
export type NotificationAdd = Except<AppNotification, "id">

export type Queue = {
	tracks: readonly TrackId[]
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
	/** The queue page which shows the next up songs */
	queue: undefined
}

export type ViewPage = {
	[Route in keyof ViewPages]: ViewPages[Route] extends undefined
		? { route: Route; parameter?: undefined }
		: { route: Route; parameter: ViewPages[Route] }
}[keyof ViewPages]
