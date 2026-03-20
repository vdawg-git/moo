import {
	distinctUntilChanged,
	filter,
	map,
	of,
	shareReplay,
	switchMap
} from "rxjs"
import { LocalTrack } from "#/database/localTrack"
import { O } from "#/lib/option"
import { getCurrentTrackIdFromState } from "./stateUtils"
import type { AppDatabase } from "#/database/types"
import type { QuerySystem } from "#/database/useQuery"
import type { Player } from "#/player/types"
import type { ErrorNotificationFn } from "#/types/types"
import type { Observable } from "rxjs"
import type { AppState } from "./types"

export function createDerivedState({
	appState$,
	database,
	player,
	addErrorNotification,
	observeQuery
}: {
	readonly appState$: Observable<AppState>
	readonly database: AppDatabase
	readonly player: Player
	readonly addErrorNotification: ErrorNotificationFn
	readonly observeQuery: QuerySystem["observeQuery"]
}) {
	const playback$ = appState$.pipe(
		map((state) => state.playback),
		shareReplay(1)
	)

	const loop$ = playback$.pipe(
		map((state) => state.loopState),
		distinctUntilChanged(),
		shareReplay(1)
	)

	const currentTrack$: Observable<LocalTrack | undefined> = playback$.pipe(
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
		map(O.maybe((track) => new LocalTrack(track, player))),
		shareReplay({ bufferSize: 1, refCount: false })
	)

	const playState$ = playback$.pipe(
		map((playback) => playback.playState),
		distinctUntilChanged(),
		shareReplay(1)
	)

	return { playback$, currentTrack$, playState$, loop$ }
}
