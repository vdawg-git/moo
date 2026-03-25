import { describe, expect, it } from "bun:test"
import { createFocusZoneState } from "./useFocusZone"

describe("createFocusZoneState", () => {
	it("initializes with default index 0", () => {
		const state = createFocusZoneState({ zoneCount: 3 })

		expect(state.getState()).toEqual({ activeIndex: 0, zoneCount: 3 })
	})

	it("initializes with custom initial zone", () => {
		const state = createFocusZoneState({ zoneCount: 4, initialZone: 2 })

		expect(state.getState().activeIndex).toBe(2)
	})

	it("goNext advances and wraps around", () => {
		const state = createFocusZoneState({ zoneCount: 3 })

		expect(state.goNext().activeIndex, "advances by 1").toBe(1)

		state.setZone(2)
		expect(state.goNext().activeIndex, "wraps to 0").toBe(0)
	})

	it("goPrevious decrements and wraps around", () => {
		const state = createFocusZoneState({ zoneCount: 3, initialZone: 2 })

		expect(state.goPrevious().activeIndex, "decrements by 1").toBe(1)

		state.setZone(0)
		expect(state.goPrevious().activeIndex, "wraps to last").toBe(2)
	})

	it("setZone sets exact index", () => {
		const state = createFocusZoneState({ zoneCount: 5 })

		const result = state.setZone(3)

		expect(result.activeIndex).toBe(3)
	})

	it("goToZone uses 1-based index", () => {
		const state = createFocusZoneState({ zoneCount: 4 })

		const result = state.goToZone(3)

		expect(result.activeIndex).toBe(2)
	})

	it("goToZone ignores out-of-range values", () => {
		const state = createFocusZoneState({ zoneCount: 3 })

		state.goToZone(0)
		expect(
			state.getState().activeIndex,
			"should ignore zone 0 (below range)"
		).toBe(0)

		state.goToZone(4)
		expect(
			state.getState().activeIndex,
			"should ignore zone 4 (above range)"
		).toBe(0)
	})
})
