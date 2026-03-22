import { useEffect, useState, useSyncExternalStore } from "react"
import type { ReadonlyBehaviorSubject } from "#/shared/library/readonlyBehaviorSubject"
import type { Observable } from "rxjs"

export function useObservable<T>(observable: Observable<T>): T | undefined {
	const [value, setValue] = useState<T | undefined>()

	useEffect(() => {
		const subscription = observable.subscribe(setValue)

		return () => subscription.unsubscribe()
	}, [observable])

	return value
}

/** Subscribes to a ReadonlyBehaviorSubject via useSyncExternalStore — no `undefined` gap. */
export function useBehaviorSubject<T>(subject: ReadonlyBehaviorSubject<T>): T {
	return useSyncExternalStore(
		(onStoreChange) => {
			const subscription = subject.subscribe(onStoreChange)

			return () => subscription.unsubscribe()
		},
		() => subject.getValue()
	)
}
