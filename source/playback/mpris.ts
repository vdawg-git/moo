import os from "node:os"
import type { MprisEventsCatalog } from "@jellybrick/mpris-service"
import * as R from "remeda"
import { filter } from "rxjs"
import { logg } from "#/logs"
import { currentTrack$, loop$, playState$ } from "#/state/derivedState"
import { appState } from "#/state/state"

/** Handles mpris. Does nothing if not compiled for Linux */
export async function handleMpris() {
	if (os.platform() !== "linux") {
		return
	}

	const { default: MprisService } = await import("@jellybrick/mpris-service")

	const mpris = new MprisService({
		name: "org.mpris.MediaPlayer2.moo",
		supportedInterfaces: ["player"],
		identity: "moo",
	})

	currentTrack$.pipe(filter(R.isNonNullish)).subscribe((track) => {
		// mpris-service logs warnings when passing undefined as it tries to parse it into values,
		// so we conditonally spread the object
		// mpris.metadata = {
		// 	"mpris:trackid": track.id,
		// 	...(track.title && { "xesam:title": track.title }),
		// 	...(track.album && { "xesam:album": track.album }),
		// 	...(track.artist && {
		// 		"xesam:artist": [track.artist]
		// 	}),
		// 	...(track.picture && {
		// 		"mpris:artUrl": `file://${track.picture}`
		// 	}),
		// 	...(track.genre && {
		// 		"xesam:genre": [track.genre]
		// 	})
		// }
		// Setting duration crashes
		// "mpris:length": track?.duration,
		// I dont get what I should pass as ID, but it works without it
		// "mpris:trackid": track?.id,
	})

	playState$.subscribe((playState) => {
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
		quit: () => appState.send({ type: "stopPlayback" }),
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
