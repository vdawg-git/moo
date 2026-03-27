import { describe, expect, it } from "bun:test"
import { firstValueFrom, Subject, take, toArray } from "rxjs"
import { Result } from "typescript-result"
import { createQuerySystem } from "./querySystem"

describe("createQuerySystem — observeQuery", () => {
	it("should emit loading state then fetched data on cache miss", async () => {
		const changed$ = new Subject<string>()
		const { observeQuery } = createQuerySystem(changed$)

		const emissions = await firstValueFrom(
			observeQuery("key", () => Promise.resolve(Result.ok(42))).pipe(
				take(2),
				toArray()
			)
		)

		expect(emissions[0]!.isLoading, "first emission should be loading").toBe(
			true
		)
		expect(emissions[0]!.data, "first emission data should be undefined").toBe(
			undefined
		)

		expect(
			emissions[1]!.isLoading,
			"second emission should not be loading"
		).toBe(false)
		expect(emissions[1]!.isFetched, "second emission should be fetched").toBe(
			true
		)
		expect(
			emissions[1]!.data!.getOrThrow(),
			"second emission should have the data"
		).toBe(42)
	})

	it("should emit cached data immediately on cache hit", async () => {
		const changed$ = new Subject<string>()
		const { observeQuery } = createQuerySystem(changed$)

		// First query populates cache
		await firstValueFrom(
			observeQuery("key", () => Promise.resolve(Result.ok(42))).pipe(
				take(2),
				toArray()
			)
		)

		// Second query with same key should hit cache
		const first = await firstValueFrom(
			observeQuery("key", () => Promise.resolve(Result.ok(42)))
		)

		expect(first.isLoading, "cache hit should not be loading").toBe(false)
		expect(first.isFetched, "cache hit should be fetched").toBe(true)
		expect(first.data!.getOrThrow(), "cache hit should have data").toBe(42)
	})

	it("should refetch when changed$ emits", async () => {
		// todo merge this boilerplate, even if its only two lines.
		const changed$ = new Subject<string>()
		const { observeQuery } = createQuerySystem(changed$)

		let counter = 0
		const query$ = observeQuery("counter", () =>
			Promise.resolve(Result.ok(++counter))
		)

		// Collect: loading + initial fetch + refetch = 3 emissions
		const emissionsPromise = firstValueFrom(query$.pipe(take(3), toArray()))

		// Wait for initial fetch to complete, then trigger refetch
		await new Promise((resolve) => setTimeout(resolve, 10))
		changed$.next("tracks")

		const emissions = await emissionsPromise

		expect(emissions[0]!.isLoading, "first should be loading").toBe(true)
		expect(
			emissions[1]!.data!.getOrThrow(),
			"initial fetch should return 1"
		).toBe(1)
		expect(emissions[2]!.data!.getOrThrow(), "refetch should return 2").toBe(2)
	})

	it("should handle query errors as Result.error", async () => {
		const changed$ = new Subject<string>()
		const { observeQuery } = createQuerySystem(changed$)

		const emissions = await firstValueFrom(
			observeQuery("fail", () => Promise.reject(new Error("db down"))).pipe(
				take(2),
				toArray()
			)
		)

		expect(emissions[1]!.isFetched, "error result should be fetched").toBe(true)
		expect(emissions[1]!.data!.isError(), "data should be a Result.error").toBe(
			true
		)
	})

	it("should handle non-Result return values by wrapping in Result.ok", async () => {
		const changed$ = new Subject<string>()
		const { observeQuery } = createQuerySystem(changed$)

		const emissions = await firstValueFrom(
			observeQuery("plain", () => Promise.resolve("hello" as any)).pipe(
				take(2),
				toArray()
			)
		)

		expect(
			emissions[1]!.data!.getOrThrow(),
			"plain value should be wrapped in Result.ok"
		).toBe("hello")
	})
})
