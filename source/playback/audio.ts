import {
	EMPTY,
	type Observable,
	Subject,
	auditTime,
	distinctUntilChanged,
	map,
	pairwise,
	startWith,
	switchMap,
	tap
} from "rxjs"
import { match } from "ts-pattern"
import { logg } from "#/logs"
import { addErrorNotification, appState, appState$ } from "#/state/state"
import { LocalTrack } from "#/database/database"
import type { Track } from "#/database/types"
import { pickCommands } from "#/commands/commandFunctions"
import {
	registerKeybinds,
	unregisterKeybinds
} from "#/keybindManager/KeybindManager"

const toPlay$: Observable<Track | undefined> = appState$.pipe(
	map((state) => {
		if (state.playback.playState !== "playing") return undefined

		const queue = state.playback.queue
		if (!queue) return undefined

		return queue.tracks[state.playback.index]
	}),

	distinctUntilChanged((previous, current) => previous?.id === current?.id),
	map((track) => track && new LocalTrack(track))
)

// Registers playback commands
appState$
	.pipe(
		map((state) => !!state.playback.queue),
		distinctUntilChanged()
	)
	.subscribe((hasQueue) => {
		const toRegister = pickCommands([
			"player.togglePlayback",
			"player.next",
			"player.playPrevious"
		])

		if (hasQueue) {
			registerKeybinds(toRegister)
		} else {
			unregisterKeybinds(toRegister)
		}
	})

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
