import { useAppContext } from "#/app/context"
import type { QueryResult } from "#/application/querySystem"
import type { Result } from "typescript-result"

export type { QueryResult } from "#/application/querySystem"

/** Standalone hook that reads the query system from app context */
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
	const { query: querySystem } = useAppContext()

	return querySystem.useQuery(key, query as () => Promise<Result<T, any>>)
}
