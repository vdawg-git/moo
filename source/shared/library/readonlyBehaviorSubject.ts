import { BehaviorSubject } from "rxjs"
import type { Observable, Subscription } from "rxjs"

/** BehaviorSubject without .next() — for consuming RxJS-derived state in React */
export type ReadonlyBehaviorSubject<T> = Omit<
	BehaviorSubject<T>,
	"next" | "error" | "complete"
>

/**
 * Wraps an Observable into a BehaviorSubject that exposes
 * `.getValue()` and `.subscribe()` but no `.next()`.
 *
 * Returns the subject and a cleanup function to tear down the internal subscription.
 */
export function toReadonlyBehaviorSubject<T>(
	source$: Observable<T>,
	initial: T
): {
	readonly subject: ReadonlyBehaviorSubject<T>
	readonly destroy: () => void
} {
	const subject = new BehaviorSubject<T>(initial)
	const subscription: Subscription = source$.subscribe((value) =>
		subject.next(value)
	)

	return {
		subject,
		destroy: () => {
			subscription.unsubscribe()
			subject.complete()
		}
	}
}
