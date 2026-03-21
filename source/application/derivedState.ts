import {
	distinctUntilChanged,
	filter,
	map,
	of,
	shareReplay,
	switchMap
} from "rxjs"
import { getCurrentTrack } from "#/core/state/stateUtils"
import type { AppDatabase, BaseTrack } from "#/ports/database"
import type { QuerySystem } from "#/application/querySystem"
import type { ErrorNotificationFn } from "#/shared/types/types"
import type { Observable } from "rxjs"
import type { AppState } from "#/core/state/types"

export function createDerivedState({
	appState$,
	database,
	addErrorNotification,
	observeQuery
}: {
	readonly appState$: Observable<AppState>
	readonly database: AppDatabase
	readonly addErrorNotification: ErrorNotificationFn
	readonly observeQuery: QuerySystem["observeQuery"]
}) {
	const playback$ = appState$.pipe(
		map((state) => state.playback),
		shareReplay({ bufferSize: 1, refCount: false })
	)

	const loop$ = playback$.pipe(
		map((state) => state.loopState),
		distinctUntilChanged(),
		shareReplay({ bufferSize: 1, refCount: false })
	)

	const currentTrack$: Observable<BaseTrack | undefined> = playback$.pipe(
		map((playback) => getCurrentTrack(playback)?.trackId),
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
							addErrorNotification(
								"Failed to get current track",
								error,
								"Failed to get current track *&+"
							)
						})
						.getOrDefault(undefined)
				)
			)
		}),
		shareReplay({ bufferSize: 1, refCount: false })
	)

	const playState$ = playback$.pipe(
		map((playback) => playback.playState),
		distinctUntilChanged(),
		shareReplay({ bufferSize: 1, refCount: false })
	)

	return { playback$, currentTrack$, playState$, loop$ }
}
