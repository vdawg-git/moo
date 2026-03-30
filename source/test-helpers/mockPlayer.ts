import { mock } from "bun:test"
import { Subject } from "rxjs"
import { Result } from "typescript-result"
import type { Player, PlayerEvent } from "#/ports/player"

/** Creates a mock player with controllable events for testing. All methods are pre-wrapped with `mock()` for spy assertions. */
export function createMockPlayer(
	overrides?: Partial<Omit<Player, "events$">>
): Player & {
	readonly emitEvent: (event: PlayerEvent) => void
} {
	const events$ = new Subject<PlayerEvent>()

	return {
		play: mock(async () => Result.ok(undefined)),
		pause: mock(async () => Result.ok(undefined)),
		clear: mock(async () => Result.ok(undefined)),
		seek: mock(async () => Result.ok(undefined)),
		seekTo: mock(async () => Result.ok(undefined)),
		...overrides,
		events$,
		emitEvent: (event) => events$.next(event)
	}
}
