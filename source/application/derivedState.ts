import { isNonNullish } from "remeda"
import {
	auditTime,
	distinctUntilChanged,
	EMPTY,
	filter,
	map,
	of,
	shareReplay,
	startWith,
	switchMap
} from "rxjs"
import { getCurrentTrack } from "#/core/state/stateUtils"
import { toReadonlyBehaviorSubject } from "#/shared/library/readonlyBehaviorSubject"
import type { QuerySystem } from "#/application/querySystem"
import type { AppState } from "#/core/state/types"
import type { AppDatabase, BaseTrack } from "#/ports/database"
import type { PlayerEvent } from "#/ports/player"
import type { ErrorNotificationFn } from "#/shared/types/types"
import type { Observable } from "rxjs"

export function createDerivedState({
	appState$,
	database,
	addErrorNotification,
	observeQuery,
	playerEvents$
}: {
	readonly appState$: Observable<AppState>
	readonly database: AppDatabase
	readonly addErrorNotification: ErrorNotificationFn
	readonly observeQuery: QuerySystem["observeQuery"]
	readonly playerEvents$: Observable<PlayerEvent>
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

	const progressSource$ = currentTrack$.pipe(
		switchMap((track) => {
			if (!track) return of(0)

			return playState$.pipe(
				switchMap((playState) => {
					if (playState === "stopped") return of(0)
					if (playState === "paused") return EMPTY

					return playerEvents$.pipe(
						map((event) =>
							event.type === "progress" ? event.currentTime : undefined
						),
						filter(isNonNullish),
						auditTime(250)
					)
				}),
				startWith(0)
			)
		})
	)

	const { subject: progress$, destroy: destroyProgress } =
		toReadonlyBehaviorSubject(progressSource$, 0)

	return {
		playback$,
		currentTrack$,
		playState$,
		loop$,
		progress$,
		destroy: destroyProgress
	}
}
