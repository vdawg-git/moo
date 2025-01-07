import type { Observable } from "rxjs"
import type { AsyncResult, Result } from "typescript-result"
import type { PlayingState } from "../types/types"

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
	play: (id: string) => Promise<Result<PlayingState, Error>>
	/**
	 * Pause the current track.
	 * Takes in the id, because we actually don't know if it might be useful
	 * for implementers.
	 * */
	pause: (id: string) => Promise<Result<PlayingState, Error>>
	/**
	 * Completes when the track has ended.
	 * Emits integers from 0 to duration in seconds.
	 *
	 * Emits an error and completes if there was an error during playback,
	 * for example if the file has errors or (in the potential future) the stream got interrupted.
	 */
	status$: Observable<Result<number, Error>>
}

/**
 * Manages the global playback.
 * Calls play/pause etc on the current tracks player.
 *
 * This is a singleton. It is only an interface to make it easier to mock.
 * (which we probably won't anyway, but hey)
 */
export interface PlaybackManager {
	play: () => AsyncResult<PlayingState, Error>
	pause: () => AsyncResult<PlayingState, Error>
	stop: () => AsyncResult<PlayingState, Error>
	togglePlayback: () => AsyncResult<PlayingState, Error>
	/**
	 * Completes when the track has ended.
	 * Emits integers from 0 to duration in seconds.
	 */
	progress$: Observable<Result<number, Error>>
}
