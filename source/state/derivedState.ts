import { distinctUntilChanged, map, shareReplay } from "rxjs"
import { appState$ } from "./state"
import { getCurrentTrackFromState } from "./stateUtils"

export const currentTrack$ = appState$.pipe(
	map(getCurrentTrackFromState),
	distinctUntilChanged((a, b) => a?.id === b?.id),
	shareReplay({ refCount: true })
)
