import { distinctUntilChanged, map, shareReplay, type Observable } from "rxjs"
import { appState$ } from "./state"
import { getCurrentTrackFromState } from "./stateUtils"
import { LocalTrack } from "#/database/database"

const playback$ = appState$.pipe(
	map((state) => state.playback),
	shareReplay()
)
export const loop$ = playback$.pipe(
	map((state) => state.loopState),
	distinctUntilChanged(),
	shareReplay()
)

export const currentTrack$: Observable<LocalTrack | undefined> = playback$.pipe(
	map(getCurrentTrackFromState),
	distinctUntilChanged((previous, current) => previous?.id === current?.id),
	map((trackMaybe) => (trackMaybe ? new LocalTrack(trackMaybe) : trackMaybe)),
	shareReplay()
)
export const playState$ = playback$.pipe(
	map((playback) => playback.playState),
	distinctUntilChanged(),
	shareReplay()
)
