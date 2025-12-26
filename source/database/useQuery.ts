// A basic TanStack Query/SWR implementation.
// We'll use this to cache the results of our database queries.

import { useCallback, useEffect, useState } from "react"
import { isNullish } from "remeda"
import {
	from,
	map,
	merge,
	type Observable,
	of,
	shareReplay,
	startWith,
	switchMap,
	tap
} from "rxjs"
import { Result } from "typescript-result"
import { database } from "./database"
import type { JsonValue } from "type-fest"

// This is in theory a memory leak, but in practice it still is
// But idc
const cache: Record<string, unknown> = {}

/** To refetch the query when the database changes */
const refresh$ = database.changed$

export function useQuery<T>(
	key: string | string[],
	query: () => Promise<Result<T, any>>
): QueryResult<T>
export function useQuery<T>(
	key: string | string[],
	query: () => Promise<T>
): QueryResult<T>
export function useQuery<T>(
	key: string | string[],
	query: () => Promise<T> | Promise<Result<T, any>>
): QueryResult<T> {
	const combinedKey = Array.isArray(key) ? key.join("-") : key

	const [state, setState] = useState<QueryResult<T>>({
		data: undefined,
		isLoading: true as const,
		isFetching: true,
		isFetched: false
	})

	// biome-ignore lint/correctness/useExhaustiveDependencies: The query should only recalculate when combinedKey changes
	const callback = useCallback(query, [combinedKey])

	useEffect(() => {
		const subscription = observeQuery(combinedKey, callback).subscribe(setState)

		return () => subscription.unsubscribe()
	}, [combinedKey, callback])

	return state
}

/** Runs and caches a query */
export function observeQuery<T>(
	key: JsonValue,
	query: () => Promise<Result<T, any>> | Promise<T>
): Observable<QueryResult<T>> {
	const cacheKey = JSON.stringify(key)
	const initialCacheValue = cache[cacheKey] as T | undefined

	const query$ = refresh$.pipe(switchMap(() => query().catch(Result.error)))
	const stream$ = merge(
		query$,
		isNullish(initialCacheValue)
			? from(query().catch(Result.error))
			: of(initialCacheValue)
	)

	return stream$.pipe(
		map((data) =>
			Result.isResult(data)
				? {
						data: data as Result<T, unknown>,
						isFetching: false as const,
						isLoading: false as const,
						isFetched: true as const
					}
				: {
						data: Result.ok(data) as Result<T, unknown>,
						isFetching: false,
						isLoading: false as const,
						isFetched: true as const
					}
		),
		tap(({ data }) => {
			data.onSuccess((success) => {
				cache[cacheKey] = success
			})
		}),
		startWith(
			isNullish(initialCacheValue)
				? {
						data: undefined,
						isFetching: true,
						isLoading: true as const,
						isFetched: false as const
					}
				: // we dont need to refetch stale data, as we just query our own db and we have a change notification with a refetch for that
					{
						data: Result.ok(initialCacheValue) as Result<T, unknown>,
						isFetching: false,
						isLoading: false as const,
						isFetched: true as const
					}
		),
		shareReplay({ refCount: true, bufferSize: 1 })
	)
}

export type QueryResult<T> =
	| {
			data: undefined
			/** Used when data is (re)fetching */
			isFetching: boolean
			/** Used the first time data is queried */
			isLoading: true
			isFetched: false
	  }
	| {
			data: Result<T, unknown>
			/** Used when data is (re)fetching */
			isFetching: boolean
			/** Used the first time data is queried */
			isLoading: false
			isFetched: true
	  }
