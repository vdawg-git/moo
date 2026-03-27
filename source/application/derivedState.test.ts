import { describe, expect, it, mock } from "bun:test"
import { firstValueFrom, Subject, take, toArray } from "rxjs"
import { Result } from "typescript-result"
import { createInitialState, trackId } from "#/test-helpers/testHelpers"
import { createDerivedState } from "./derivedState"
import { createQuerySystem } from "./querySystem"
import type { AppState } from "#/core/state/types"
import type { BaseTrack } from "#/ports/database"
import type { PlayerEvent } from "#/ports/player"
import type { ErrorNotificationFn } from "#/shared/types/types"

function createTestDerived() {
	const appState$ = new Subject<AppState>()
	const playerEvents$ = new Subject<PlayerEvent>()
	const addErrorNotification = mock<ErrorNotificationFn>(() => {})
	const queryChanged$ = new Subject<string>()
	const { observeQuery } = createQuerySystem(queryChanged$)

	const mockTrack: BaseTrack = {
		id: trackId("track-1"),
		title: "Test Track",
		artist: "Test Artist",
		album: "Test Album",
		duration: 200,
		picture: undefined,
		genre: [],
		albumartist: undefined,
		mood: []
	}

	const database = {
		getTrack: mock(async () => Result.ok(mockTrack))
	} as any

	const derived = createDerivedState({
		appState$,
		database,
		addErrorNotification,
		observeQuery,
		playerEvents$
	})

	return {
		appState$,
		playerEvents$,
		addErrorNotification,
		database,
		derived,
		mockTrack
	}
}

describe("createDerivedState", () => {
	it("should emit distinct playState values only", async () => {
		const { appState$, derived } = createTestDerived()

		const emissionsPromise = firstValueFrom(
			derived.playState$.pipe(take(2), toArray())
		)

		appState$.next(createInitialState({ playState: "stopped" }))
		appState$.next(createInitialState({ playState: "stopped" }))
		appState$.next(createInitialState({ playState: "playing" }))

		const emissions = await emissionsPromise
		expect(emissions, "should emit 2 distinct values").toHaveLength(2)
		expect(emissions[0]).toBe("stopped")
		expect(emissions[1]).toBe("playing")
	})

	it("should emit distinct loop values only", async () => {
		const { appState$, derived } = createTestDerived()

		const emissionsPromise = firstValueFrom(
			derived.loop$.pipe(take(2), toArray())
		)

		appState$.next(createInitialState({ loopState: "none" }))
		appState$.next(createInitialState({ loopState: "none" }))
		appState$.next(createInitialState({ loopState: "loop_track" }))

		const emissions = await emissionsPromise
		expect(emissions, "should emit 2 distinct values").toHaveLength(2)
		expect(emissions[0]).toBe("none")
		expect(emissions[1]).toBe("loop_track")
	})

	it("should resolve currentTrack from database when track ID changes", async () => {
		const { appState$, derived, mockTrack } = createTestDerived()

		const trackPromise = firstValueFrom(derived.currentTrack$)

		appState$.next(
			createInitialState({
				tracks: [trackId("track-1")],
				playState: "playing"
			})
		)

		const track = await trackPromise
		expect(track, "should resolve track from database").toBeDefined()
		expect(track!.id, "should have the correct track id").toBe(mockTrack.id)
	})

	it("should emit undefined currentTrack when no track is playing", async () => {
		const { appState$, derived } = createTestDerived()

		const trackPromise = firstValueFrom(derived.currentTrack$)

		appState$.next(createInitialState())

		const track = await trackPromise
		expect(track, "should be undefined with no queue").toBeUndefined()
	})

	it("should call addErrorNotification when track lookup fails", async () => {
		const { appState$, derived, database, addErrorNotification } =
			createTestDerived()
		database.getTrack.mockImplementation(async () =>
			Result.error(new Error("db fail"))
		)

		const trackPromise = firstValueFrom(derived.currentTrack$)

		appState$.next(
			createInitialState({
				tracks: [trackId("track-1")],
				playState: "playing"
			})
		)

		await trackPromise
		expect(
			addErrorNotification,
			"should notify error on track lookup failure"
		).toHaveBeenCalledTimes(1)
	})

	it("should emit progress 0 when no track is loaded", async () => {
		const { appState$, derived } = createTestDerived()

		appState$.next(createInitialState())

		// progress$ is a BehaviorSubject, give it a tick to process
		await new Promise((resolve) => setTimeout(resolve, 20))

		expect(
			derived.progress$.getValue(),
			"progress should be 0 with no track"
		).toBe(0)
	})

	it("should emit progress 0 when playState is stopped", async () => {
		const { appState$, derived } = createTestDerived()

		appState$.next(
			createInitialState({
				tracks: [trackId("track-1")],
				playState: "stopped"
			})
		)

		await new Promise((resolve) => setTimeout(resolve, 20))

		expect(
			derived.progress$.getValue(),
			"progress should be 0 when stopped"
		).toBe(0)
	})

	it("should cleanup subscriptions on destroy", async () => {
		const { appState$, derived } = createTestDerived()

		appState$.next(createInitialState())

		derived.destroy()

		let completed = false
		derived.progress$.subscribe({ complete: () => (completed = true) })

		expect(completed, "progress$ should complete on destroy").toBe(true)
	})
})
