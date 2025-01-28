import type { Observable } from "rxjs"
import type { Result } from "typescript-result"
import type { TrackId } from "#/database/types"

/**
 * The methods a player needs to implement.
 *
 * Right now this is overkill as we only support direct local playback,
 * but it might be useful if we want to support Spotify, or MPD as well.
 * */
export interface Player {
	/**
	 * Plays the specified track.
	 * Loads the track if it is not already loaded.
	 * */
	play: (id: TrackId) => Promise<Result<unknown, Error>>

	/**
	 * Pause the current track.
	 * Takes in the id, because we actually don't know if it might be useful
	 * for implementers.
	 * */
	pause: (id: TrackId) => Promise<Result<unknown, Error>>

	/**
	 * Unloads the currently used memory and stops playback.
	 *
	 * Should not destroy the player instance.
	 *
	 * Used if a different player starts playing.
	 */
	clear: () => Promise<Result<unknown, unknown>>

	/**
	 * Seeks forwards or backwards by the given amount in seconds.
	 */
	seek: (seconds: number) => Promise<Result<unknown, unknown>>

	/**
	 * Seeks to the given time in seconds if the argument is a number.
	 * Otherwise seeks to the given percantage.
	 */
	seekTo: (to: number | string) => Promise<Result<unknown, unknown>>

	/**
	 * Emits events.
	 * Emits progress integers from 0 to duration in seconds.
	 *
	 * Emits an error and completes if there was an error during playback,
	 * for example if the file has errors or (in the potential future) the stream got interrupted.
	 */
	events$: Observable<PlayerEvent>
}

export type PlayerEvent =
	| { type: "finishedTrack" }
	| {
			type: "progress"
			currentTime: number
	  }
	| { type: "error"; error: unknown }
