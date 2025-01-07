import { AudioContext } from "node-web-audio-api"
import { type Observable, Subject } from "rxjs"
import { Result } from "typescript-result"
import type { Player } from "./types"

export function createLocalPlayer(): Player {
	const audioContext = new AudioContext()
	const progessInput$: Observable<Result<number, Error>> = new Subject()
	const status$ = progessInput$.pipe()

	return {
		async play(id) {
			console.log("play", id)
			return Result.ok("playing")
		},
		async pause(id) {
			console.log("pause", id)
			return Result.ok("paused")
		},
		status$,
	}
}
