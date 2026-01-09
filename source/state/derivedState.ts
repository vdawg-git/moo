import {
	distinctUntilChanged,
	filter,
	map,
	of,
	shareReplay,
	switchMap
} from "rxjs"
import { database, LocalTrack } from "#/database/database"
import { observeQuery } from "#/database/useQuery"
import { enumarateError, logg } from "#/logs"
import { addErrorNotification, appState$ } from "./state"
import { getCurrentTrackIdFromState } from "./stateUtils"
import type { Observable } from "rxjs"

const playback$ = appState$.pipe(
	map((state) => state.playback),
	shareReplay(1)
)
export const loop$ = playback$.pipe(
	map((state) => state.loopState),
	distinctUntilChanged(),
	shareReplay(1)
)

export const currentTrack$: Observable<LocalTrack | undefined> = playback$.pipe(
	map(getCurrentTrackIdFromState),
	distinctUntilChanged(),
	switchMap((idMaybe) => {
		if (!idMaybe) return of(undefined)

		return observeQuery(["track", idMaybe], () =>
			database.getTrack(idMaybe)
		).pipe(
			filter(({ isFetched }) => isFetched),
			map(({ data }) =>
				data
					?.onFailure((error) => {
						logg.error("Failed to get current track *&+", enumarateError(error))
						addErrorNotification("Failed to get current track")
					})
					.getOrDefault(undefined)
			)
		)
	}),
	map((trackMaybe) => (trackMaybe ? new LocalTrack(trackMaybe) : trackMaybe)),
	shareReplay({ bufferSize: 1, refCount: false })
)

export const playState$ = playback$.pipe(
	map((playback) => playback.playState),
	distinctUntilChanged(),
	shareReplay(1)
)
