import {
	distinctUntilChanged,
	filter,
	map,
	type Observable,
	of,
	shareReplay,
	switchMap,
	tap
} from "rxjs"
import { database, LocalTrack } from "#/database/database"
import { observeQuery } from "#/database/useQuery"
import { enumarateError, logg } from "#/logs"
import { addErrorNotification, appState$ } from "./state"
import { getCurrentTrackIdFromState } from "./stateUtils"

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
	tap((track) => logg.debug("currentTrack a", { track: track?.id })),
	map((trackMaybe) => (trackMaybe ? new LocalTrack(trackMaybe) : trackMaybe)),
	shareReplay({ bufferSize: 1, refCount: false })
)

export const playState$ = playback$.pipe(
	map((playback) => playback.playState),
	distinctUntilChanged(),
	shareReplay()
)
