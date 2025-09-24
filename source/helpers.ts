import { mapValues } from "remeda"
import type { NullsToUndefined } from "./types/utillities"

/** Converts all _top-level_ values from null to undefined */
export function nullsToUndefined<T extends Record<string, unknown>>(
	object: T
): NullsToUndefined<T> {
	return mapValues(
		object,
		(value) => value ?? undefined
	) as unknown as NullsToUndefined<T>
}

const stripIndentRegex = /^[ \t]+/gm
/**
 * Strips *all* indents on each line of the string.
 */
export function stripIndent(string: string): string {
	return string.replace(stripIndentRegex, "")
}

export function shuffleWithMap<T>(
	toShuffle: readonly T[],
	protectIndexes: readonly number[] = []
): {
	shuffled: T[]
	shuffleMap: number[]
} {
	const indices = toShuffle.map((_, index) => index)
	const shuffledIndices = [...indices]

	// Fisher–Yates shuffle
	for (let index = shuffledIndices.length - 1; index > 0; index--) {
		const jndex = Math.floor(Math.random() * (index + 1))
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		;[shuffledIndices[index]!, shuffledIndices[jndex]!] = [
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			shuffledIndices[jndex]!,
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			shuffledIndices[index]!
		]
	}

	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	const shuffled = shuffledIndices.map((index) => toShuffle[index]!)

	return { shuffled, shuffleMap: shuffledIndices }
}

export function unshuffleFromMap<T>(
	shuffled: readonly T[],
	shuffleMap: readonly number[]
): T[] {
	const unshuffled = Array(shuffled.length)

	shuffleMap.forEach((originalIndex, shuffledIndex) => {
		unshuffled[originalIndex] = shuffled[shuffledIndex]
	})
	return unshuffled
}
