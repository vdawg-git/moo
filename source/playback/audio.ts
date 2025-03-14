import {
	EMPTY,
	type Observable,
	Subject,
	auditTime,
	combineLatest,
	distinctUntilChanged,
	filter,
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
import MprisService, {
	type MprisEventsCatalog
} from "@jellybrick/mpris-service"
import * as R from "remeda"

const mpris = new MprisService({
	name: "org.mpris.MediaPlayer2.moo",
	supportedInterfaces: ["player"],
	identity: "moo"
})

const playback$ = appState$.pipe(map((state) => state.playback))
const loop$ = playback$.pipe(
	map((state) => state.loopState),
	distinctUntilChanged()
)

const currentTrack$ = playback$.pipe(
	map(({ isPlayingFromManualQueue, queue, manuallyAdded, index }) => {
		if (isPlayingFromManualQueue) {
			return manuallyAdded[index]
		}

		return queue?.tracks[index]
	}),
	distinctUntilChanged((previous, current) => previous?.id === current?.id)
)
const playState$ = playback$.pipe(
	map((playback) => playback.playState),
	distinctUntilChanged()
)

const toPlay$: Observable<Track | undefined> = combineLatest([
	currentTrack$,
	playState$
]).pipe(
	map(([track, playState]) => (playState !== "playing" ? undefined : track)),
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
export function handleAudioPlayback() {
	handleMpris()

	return handlePlayer()
}

function handlePlayer() {
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
			tap((playEvent) => logg.debug("playevent", { playEvent }))
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

			current.play()
		})

	return () =>
		[playSubscription, playEventsSubscription, progressSubscription].forEach(
			(subscription) => subscription.unsubscribe()
		)
}

function handleMpris() {
	currentTrack$.pipe(filter(R.isNonNullish)).subscribe((track) => {
		// mpris-service logs warnings when passing undefined as it tries to parse it into values,
		// so we conditonally spread the object
		mpris.metadata = {
			"xesam:title": track.title ?? track?.id,
			...(track.album && { "xesam:album": track.album }),
			...(track.artist && {
				"xesam:artist": track.artist ? [track.artist] : undefined
			}),
			...(track.picture && {
				"mpris:artUrl": track.picture && `file://${track.picture}`
			})
		}
		mpris.canQuit = true

		// Setting duration crashes
		// "mpris:length": track?.duration,
		// I dont get what I should pass as ID, but it works without it
		// "mpris:trackid": track?.id,
	})

	playState$.subscribe((playState) => {
		const hasPlayback = playState !== "stopped"

		mpris.canPause = playState === "playing"
		mpris.canPlay = hasPlayback && playState === "paused"
		mpris.canGoPrevious = hasPlayback
		mpris.playbackStatus =
			playState === "playing"
				? "Playing"
				: playState === "paused"
					? "Paused"
					: "Stopped"
		mpris.canGoNext = hasPlayback
		mpris.canControl = hasPlayback
	})

	loop$.subscribe((loop) => {
		mpris.loopStatus =
			loop === "loop_track"
				? "Track"
				: loop === "loop_queue"
					? "Playlist"
					: "None"
	})

	const handlers: {
		[T in keyof MprisEventsCatalog]?: (data: MprisEventsCatalog[T]) => void
	} = {
		next: () => appState.send({ type: "nextTrack" }),
		previous: () => {
			appState.send({ type: "previousTrack" })
		},
		playpause: () => {
			appState.send({ type: "togglePlayback" })
		},
		pause: () => {
			appState.send({ type: "togglePlayback" })
		},
		play: () => {
			appState.send({ type: "togglePlayback" })
		},
		stop: () => appState.send({ type: "togglePlayback" }),
		quit: () => appState.send({ type: "stopPlayback" })
	}

	for (const [event, handler] of Object.entries(handlers)) {
		//@ts-expect-error
		mpris.on(event, (data) => {
			logg.debug("mpris event", { event, data })
			//@ts-expect-error
			handler(data)
		})
	}
}
