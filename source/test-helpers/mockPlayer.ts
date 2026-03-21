import { Subject } from "rxjs"
import { Result } from "typescript-result"
import type { Player, PlayerEvent } from "#/ports/player"

/** Creates a mock player with controllable events for testing */
export function createMockPlayer(): Player & {
	readonly emitEvent: (event: PlayerEvent) => void
} {
	const events$ = new Subject<PlayerEvent>()

	return {
		play: async () => Result.ok(undefined),
		pause: async () => Result.ok(undefined),
		clear: async () => Result.ok(undefined),
		seek: async () => Result.ok(undefined),
		seekTo: async () => Result.ok(undefined),
		events$,
		emitEvent: (event) => events$.next(event)
	}
}
