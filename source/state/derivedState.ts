import { distinctUntilChanged, map, shareReplay } from "rxjs"
import { appState$ } from "./state"
import { getCurrentTrackFromState } from "./stateUtils"

const playback$ = appState$.pipe(
	map((state) => state.playback),
	shareReplay()
)
export const loop$ = playback$.pipe(
	map((state) => state.loopState),
	distinctUntilChanged(),
	shareReplay()
)

export const currentTrack$ = playback$.pipe(
	map(getCurrentTrackFromState),
	distinctUntilChanged((previous, current) => previous?.id === current?.id),
	shareReplay()
)
export const playState$ = playback$.pipe(
	map((playback) => playback.playState),
	distinctUntilChanged(),
	shareReplay()
)
