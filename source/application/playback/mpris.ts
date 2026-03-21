import { createHash } from "node:crypto"
import os from "node:os"
import MprisService from "@jellybrick/mpris-service"
import * as R from "remeda"
import { filter } from "rxjs"
import { logger } from "#/shared/logs"
import type { MprisEventsCatalog } from "@jellybrick/mpris-service"
import type { BaseTrack } from "#/ports/database"
import type { AppStore } from "#/core/state/state"
import type { AppState } from "#/core/state/types"
import type { Observable } from "rxjs"

type MprisDeps = {
	readonly appState: AppStore
	readonly currentTrack$: Observable<BaseTrack | undefined>
	readonly loop$: Observable<AppState["playback"]["loopState"]>
	readonly playState$: Observable<AppState["playback"]["playState"]>
}

/** Handles mpris. Does nothing if not compiled for Linux */
export function handleMpris({
	appState,
	currentTrack$,
	loop$,
	playState$
}: MprisDeps) {
	if (os.platform() !== "linux") {
		return () => {}
	}

	const mpris = new MprisService({
		name: "org.mpris.MediaPlayer2.moo",
		supportedInterfaces: ["player"],
		identity: "moo"
	})

	const subscriptionCurrentTrack = currentTrack$
		.pipe(filter(R.isNonNullish))
		.subscribe((track) => {
			const trackIdHash = createHash("md5").update(track.id).digest("hex")

			mpris.metadata = {
				"mpris:trackid": `/org/mpris/MediaPlayer2/Track/${trackIdHash}`,
				...(track.title && { "xesam:title": track.title }),
				...(track.album && { "xesam:album": track.album }),
				...(track.artist && { "xesam:artist": [track.artist] }),
				...(track.picture && {
					"mpris:artUrl": `file://${track.picture}`
				}),
				...(track.genre && { "xesam:genre": [...track.genre] }),
				...(track.duration && {
					"mpris:length": Math.round(track.duration * 1_000_000)
				})
			}
		})

	const subscriptionPlayState = playState$.subscribe((playState) => {
		const hasPlayback = playState !== "stopped"

		mpris.canControl = hasPlayback
		if (!hasPlayback) return

		// Always set those two to true, otherwise `$ playerctl` wont work well
		mpris.canPlay = true
		mpris.canPause = true
		mpris.canGoPrevious = true
		mpris.canGoNext = true
		mpris.playbackStatus =
			playState === "playing"
				? "Playing"
				: playState === "paused"
					? "Paused"
					: "Stopped"
	})

	const subscriptionLoop = loop$.subscribe((loop) => {
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
		previous: () => appState.send({ type: "previousTrack" }),
		playpause: () => appState.send({ type: "togglePlayback" }),
		pause: () => appState.send({ type: "pausePlayback" }),
		play: () => appState.send({ type: "resumePlayback" }),
		stop: () => appState.send({ type: "stopPlayback" }),
		quit: () => appState.send({ type: "stopPlayback" })
	}

	for (const [event, handler] of Object.entries(handlers)) {
		//@ts-expect-error
		mpris.on(event, (data) => {
			logger.debug("mpris event", { event, data })
			//@ts-expect-error
			handler(data)
		})
	}

	return () => {
		subscriptionLoop.unsubscribe()
		subscriptionPlayState.unsubscribe()
		subscriptionCurrentTrack.unsubscribe()
	}
}
