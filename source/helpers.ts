import { mapValues } from "remeda"
import type { NullToUndefined } from "./types/utillities"

/** Converts all _top-level_ values from null to undefined */
export function nullsToUndefined<T extends object>(
	object: T
): NullToUndefined<T> {
	return mapValues(
		object,
		(value) => value ?? undefined
	) as unknown as NullToUndefined<T>
}
