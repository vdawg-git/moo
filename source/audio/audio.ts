import type { Track } from "#/database/types"
import { logg } from "#/logs"
import { addErrorNotification, appState, appState$ } from "#/state/state"
import {
	auditTime,
	distinctUntilChanged,
	EMPTY,
	map,
	pairwise,
	startWith,
	Subject,
	switchMap,
	tap,
	type Observable
} from "rxjs"
import { match } from "ts-pattern"

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
	/**
	 * Progress has its own stream,
	 * so that we are able to throttle it here,
	 * without Players having to worry about that.
	 */
	const progressInput$ = new Subject<number>()
	const progressSubscription = progressInput$
		.pipe(auditTime(500))
		.subscribe((newTime) => {
			appState.send({ type: "setPlayProgress", newTime })
		})

	const playEventsSubscription = toPlay$
		.pipe(
			switchMap((track) => track?.events$ ?? EMPTY),
			tap((playEvent) =>
				logg.debug(`playevent: ${playEvent.type}`, playEvent, "playevent")
			)
		)
		.subscribe((event) =>
			match(event)
				.with({ type: "finishedTrack" }, () =>
					appState.send({ type: "nextTrack" })
				)

				.with({ type: "error" }, (error) => {
					addErrorNotification("Error when playing back", error)
					appState.send({ type: "nextTrack" })
				})

				.with({ type: "progress" }, ({ currentTime }) => {
					progressInput$.next(currentTime)
				})
				.exhaustive()
		)

	const playSubscription = toPlay$
		.pipe(startWith(undefined), pairwise())
		.subscribe(([previous, current]) => {
			// Wether the source has changed and the current player should be cleared
			// Do not clear if previous or current is undefined, because this could just
			// mean that the playback got paused.
			const hasSourceChanged =
				previous &&
				current &&
				previous.sourceProvider !== current?.sourceProvider

			if (hasSourceChanged) {
				previous?.clear()
			}

			if (!current) {
				previous?.pause()
				return
			}

			current?.play()
		})

	return () =>
		[playSubscription, playEventsSubscription, progressSubscription].forEach(
			(subscription) => subscription.unsubscribe()
		)
}
