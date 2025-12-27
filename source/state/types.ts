import type { ReactNode } from "react"
import type { Except } from "type-fest"
import type { AppColorName } from "#/config/theme"
import type { KeybindCommandWhen } from "#/keybindManager/keybindsState"
import type { AlbumId, ArtistId, PlaylistId, TrackId } from "../database/types"
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

	focusedInputs: readonly string[]
	/**
	 * By default it is `type: default`.
	 * If for example the modal manager shows a component it should
	 * become `type: modal` to prevent all the global keybindings to infer with
	 * the keybinds within the modal component.
	 */
	keybindingWhen: readonly KeybindWhenRegistered[]
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
	onCloseModal: () => void
	onChangeTitle: (title: string) => void
	onChangeColor: (color: AppColorName) => void
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
	| { type: "playlist"; id: PlaylistId }
	| { type: "album"; id: AlbumId }
	| { type: "artist"; id: ArtistId }
	| {
			/** Everything from the library */
			type: "all"
	  }

/**
 * This dictates the navigation
 * Each key is a route. The value is the data that is passed to the page
 * */
export interface ViewPages {
	// the homeview should be configurable via the config
	home: undefined
	playlist: { id: PlaylistId }
	album: { id: AlbumId }
	artist: { id: ArtistId }
	search: undefined
	/** The queue page which shows the next up songs */
	queue: undefined
}

export type ViewPage = {
	[Route in keyof ViewPages]: ViewPages[Route] extends undefined
		? { route: Route; parameter?: undefined }
		: { route: Route; parameter: ViewPages[Route] }
}[keyof ViewPages]

export type KeybindWhenRegistered = { type: KeybindCommandWhen; id: string }
