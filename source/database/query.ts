// A basic TanStack Query/SWR implementation.
// We'll use this to cache the results of our database queries.

import { Result } from "typescript-result"
import { database } from "./database"
import {
	from,
	map,
	merge,
	of,
	startWith,
	switchMap,
	tap,
	type Observable
} from "rxjs"
import { isNullish } from "remeda"
import { useEffect, useState } from "react"

const cache: Record<string, unknown> = {}

const refresh$ = database.changed$

export function useQuery<T>(
	key: string | string[],
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	query: () => Promise<Result<T, any>>
): QueryResult<T>
export function useQuery<T>(
	key: string | string[],
	query: () => Promise<T>
): QueryResult<T>
export function useQuery<T>(
	key: string | string[],
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	query: () => Promise<T> | Promise<Result<T, any>>
): QueryResult<T> {
	const [state, setState] = useState<QueryResult<T>>({
		data: undefined,
		isLoading: true as const,
		isFetching: true
	})

	useEffect(() => {
		const subscription = observeQuery(key, query).subscribe(setState)

		return () => subscription.unsubscribe()
	}, [key, query])

	return state
}

function observeQuery<T>(
	key: string | string[],
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	query: () => Promise<T> | Promise<Result<T, any>>
): Observable<QueryResult<T>> {
	const cacheKey = Array.isArray(key) ? key.join(".") : key
	const initialCacheValue = cache[cacheKey] as T

	const query$ = refresh$.pipe(switchMap(() => query().catch(Result.error)))
	const stream$ = merge(
		query$,
		isNullish(initialCacheValue)
			? from(query().catch(Result.error))
			: of(initialCacheValue)
	)

	return stream$.pipe(
		map((data) => {
			return Result.isResult(data)
				? {
						data: data as Result<T, unknown>,
						isFetching: false as const,
						isLoading: false as const
					}
				: {
						data: Result.ok(data),
						isFetching: false,
						isLoading: false as const
					}
		}),
		tap(({ data }) =>
			data.onSuccess(() => {
				cache[cacheKey] = data
			})
		),
		startWith(
			isNullish(initialCacheValue)
				? { data: undefined, isFetching: true, isLoading: true as const }
				: // we dont need to refetch data, as we just query our own db
					{
						data: Result.ok(initialCacheValue),
						isFetching: false,
						isLoading: false as const
					}
		)
		// shareReplay({ refCount: true }),
	)
}

type QueryResult<T> =
	| {
			data: undefined
			/** Used when data is (re)fetching */
			isFetching: boolean
			/** Used the first time data is queried */
			isLoading: true
	  }
	| {
			data: Result<T, unknown>
			/** Used when data is (re)fetching */
			isFetching: boolean
			/** Used the first time data is queried */
			isLoading: false
	  }
