import { describe, expect, it } from "bun:test"
import { createListState } from "./listState"

const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]

function createTestState(overrides?: { items?: readonly string[] }) {
	const { state } = createListState({ items: overrides?.items ?? items })

	state.trigger.setScrollboxSize({
		scrollboxHeight: 5,
		viewportHeight: 4
	})

	return state
}

function context(state: ReturnType<typeof createTestState>) {
	return state.get().context
}

describe("goNext", () => {
	it("moves cursor without scrolling when mid-viewport", () => {
		const state = createTestState()

		state.trigger.goNext()

		expect(context(state).index).toBe(1)
		expect(context(state).scrollPosition).toBe(0)
	})

	it("scrolls when cursor reaches viewport bottom", () => {
		const state = createTestState()

		for (let step = 0; step < 5; step++) {
			state.trigger.goNext()
		}

		// scrollboxHeight is 5, so cursor at 4 is last visible row → next triggers scroll
		expect(context(state).index).toBe(5)
		expect(context(state).scrollPosition).toBe(1)
	})

	it("no-ops when scrollboxHeight is 0", () => {
		const { state } = createListState({ items })

		state.trigger.goNext()

		expect(context(state).index).toBe(0)
	})

	it("clamps at last item", () => {
		const state = createTestState({ items: ["a", "b"] })

		state.trigger.goNext()
		state.trigger.goNext()
		state.trigger.goNext()

		expect(context(state).index).toBe(1)
	})
})

describe("goPrevious", () => {
	it("scrolls when cursor reaches viewport top", () => {
		const state = createTestState()
		state.trigger.setIndex({ index: 1 })
		state.trigger.setScrollPosition({ scrollPosition: 1 })

		state.trigger.goPrevious()

		expect(context(state).index).toBe(0)
		expect(context(state).scrollPosition).toBe(0)
	})

	it("does not scroll when mid-viewport", () => {
		const state = createTestState()
		state.trigger.setIndex({ index: 3 })

		state.trigger.goPrevious()

		expect(context(state).index).toBe(2)
		expect(context(state).scrollPosition).toBe(0)
	})

	it("clamps at first item", () => {
		const state = createTestState()

		state.trigger.goPrevious()

		expect(context(state).index).toBe(0)
	})
})

describe("centerIfNotVisible", () => {
	it("centers item when out of view below", () => {
		const state = createTestState()

		state.trigger.centerIfNotVisible({ itemIndex: 8 })

		// item 8 centered in viewport of 5 → scroll to max(0, 8 - floor(5/2)) = 6
		expect(context(state).scrollPosition).toBe(6)
		expect(context(state).index).toBe(0)
	})

	it("no-ops when item is already visible", () => {
		const state = createTestState()

		state.trigger.centerIfNotVisible({ itemIndex: 2 })

		expect(context(state).scrollPosition).toBe(0)
	})

	it("no-ops when scrollboxHeight is 0", () => {
		const { state } = createListState({ items })

		state.trigger.centerIfNotVisible({ itemIndex: 8 })

		expect(context(state).scrollPosition).toBe(0)
	})

	it("no-ops for items not in the list", () => {
		const state = createTestState()

		state.trigger.centerIfNotVisible({ itemIndex: 99 })

		expect(context(state).scrollPosition).toBe(0)
	})
})

describe("scrollDown / scrollUp", () => {
	it("scrollDown jumps by viewport height", () => {
		const state = createTestState()

		state.trigger.scrollDown()

		// viewportHeight is 4
		expect(context(state).scrollPosition).toBe(4)
		expect(context(state).index).toBeGreaterThan(0)
	})

	it("scrollUp jumps by viewport height", () => {
		const state = createTestState()
		state.trigger.setScrollPosition({ scrollPosition: 5 })
		state.trigger.setIndex({ index: 7 })

		state.trigger.scrollUp()

		// 5 - 4 = 1
		expect(context(state).scrollPosition).toBe(1)
	})

	it("no-ops when viewportHeight is 0", () => {
		const { state } = createListState({ items })

		state.trigger.scrollDown()
		expect(context(state).scrollPosition).toBe(0)

		state.trigger.scrollUp()
		expect(context(state).scrollPosition).toBe(0)
	})
})

describe("scroll snaps back after centerIfNotVisible", () => {
	it("goNext snaps viewport back to cursor when centerIfNotVisible scrolled far away", () => {
		const state = createTestState()
		// cursor at 2, viewport showing 0–4
		state.trigger.setIndex({ index: 2 })

		// centerIfNotVisible scrolls viewport to item 8 (centered), cursor stays at 2
		state.trigger.centerIfNotVisible({ itemIndex: 8 })
		expect(context(state).scrollPosition).toBe(6)
		expect(context(state).index).toBe(2)

		// pressing j should snap viewport back to show cursor (at top of viewport)
		state.trigger.goNext()
		expect(context(state).index).toBe(3)
		expect(context(state).scrollPosition).toBe(3)
	})

	it("goPrevious snaps viewport back to cursor when centerIfNotVisible scrolled far away", () => {
		const state = createTestState()
		state.trigger.setIndex({ index: 7 })
		state.trigger.setScrollPosition({ scrollPosition: 3 })

		// centerIfNotVisible scrolls viewport to item 1 (centered), cursor stays at 7
		state.trigger.centerIfNotVisible({ itemIndex: 1 })
		expect(context(state).scrollPosition).toBe(0)
		expect(context(state).index).toBe(7)

		// pressing k should snap viewport back to show cursor
		state.trigger.goPrevious()
		expect(context(state).index).toBe(6)
		expect(context(state).scrollPosition).toBe(2)
	})
})

describe("goFirst / goLast", () => {
	it("goFirst resets to top", () => {
		const state = createTestState()
		state.trigger.setIndex({ index: 5 })
		state.trigger.setScrollPosition({ scrollPosition: 3 })

		state.trigger.goFirst()

		expect(context(state).index).toBe(0)
		expect(context(state).scrollPosition).toBe(0)
	})

	it("goLast jumps to end", () => {
		const state = createTestState()

		state.trigger.goLast()

		expect(context(state).index).toBe(9)
		expect(context(state).scrollPosition).toBe(9)
	})
})
