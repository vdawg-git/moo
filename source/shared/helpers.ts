import { mkdir, readdir } from "node:fs/promises"
import { mapValues } from "remeda"
import { Result } from "typescript-result"
import type { AsyncResult } from "typescript-result"
import type { FilePath } from "./types/types"
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

export function shuffleWithMap<T>(toShuffle: readonly T[]): {
	shuffled: T[]
	shuffleMap: number[]
} {
	const indices = toShuffle.map((_, index) => index)
	const shuffledIndices = [...indices]

	// Fisher–Yates shuffle
	for (let index = shuffledIndices.length - 1; index > 0; index--) {
		const jndex = Math.floor(Math.random() * (index + 1))
		;[shuffledIndices[index]!, shuffledIndices[jndex]!] = [
			shuffledIndices[jndex]!,
			shuffledIndices[index]!
		]
	}

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

/** Calls all provided callbacks */
export function callAll(callbacks: readonly (() => unknown)[]): void {
	callbacks.forEach((callback) => callback())
}

/**
 * Creates the directory if it does not exist.
 *
 * @return true if the directory existed, otherwise false
 */
export function ensureDirectoryExists(
	directoryPath: FilePath
): AsyncResult<boolean, Error> {
	return Result.fromAsyncCatching(
		(async () => {
			const exists = await checkDirectoryExists(directoryPath)

			return exists
				? Result.ok(exists)
				: Result.fromAsyncCatching(
						mkdir(directoryPath, { recursive: true })
					).map(() => false)
		})()
	)
}

async function checkDirectoryExists(directoryPath: FilePath): Promise<boolean> {
	return readdir(directoryPath)
		.then(() => true)
		.catch(() => false)
}
