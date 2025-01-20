import type { Track } from "#/database/types"
import { appState$ } from "#/state/state"
import {
	distinctUntilChanged,
	map,
	pairwise,
	startWith,
	type Observable
} from "rxjs"

const toPlay$: Observable<Track | undefined> = appState$.pipe(
	map((state) => {
		if (state.playback.playState !== "playing") return undefined

		const queue = state.playback.queue
		if (!queue) return undefined

		return queue.tracks[state.playback.index]
	}),

	distinctUntilChanged((previous, current) => previous?.id === current?.id)
)

/**
 * Listen to state changes and play the applicable track.
 *
 * Returns the subscription which can be unsubscribed from.
 */
export function registerAudioPlayback() {
	return toPlay$
		.pipe(startWith(undefined), pairwise())
		.subscribe(([previous, current]) => {
			if (previous?.sourceProvider !== current?.sourceProvider) {
				previous?.clear()
			}

			if (!current) {
				previous?.pause()
				return
			}

			current?.play()
		})
}
