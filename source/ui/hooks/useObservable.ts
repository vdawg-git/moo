import { useEffect, useState } from "react"
import type { Observable } from "rxjs"

export function useObservable<T>(observable: Observable<T>): T | undefined {
	const [value, setValue] = useState<T | undefined>()

	useEffect(() => {
		const subscription = observable.subscribe(setValue)

		return () => subscription.unsubscribe()
	}, [observable])

	return value
}
