import { AudioContext, OscillatorNode, GainNode } from "node-web-audio-api"
import type { Player } from "./types"
import { BehaviorSubject, Subject, type Observable } from "rxjs"
import { Result } from "typescript-result"

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
