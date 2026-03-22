import { describe, expect, it } from "bun:test"
import { createQuickEditState } from "./quickEditState"
import type { SuggestionsRecord } from "./quickEditState"

function createState({
	appliedTags = { mood: [], genre: [] },
	suggestions = { mood: [], genre: [] },
	defaultTagType = "mood" as const
}: {
	appliedTags?: SuggestionsRecord
	suggestions?: SuggestionsRecord
	defaultTagType?: "mood" | "genre"
} = {}) {
	return createQuickEditState({ appliedTags, suggestions, defaultTagType })
}

function getContext(state: ReturnType<typeof createState>) {
	return state.state.get().context
}

describe("createQuickEditState", () => {
	it("initializes with applied tags and default tag type", () => {
		const { state, suggestionsAtom, tagsActiveAtom } = createState({
			appliedTags: { mood: ["chill"], genre: ["rock"] },
			defaultTagType: "genre"
		})
		const context = state.get().context

		expect(context.tagsApplied).toEqual({ mood: ["chill"], genre: ["rock"] })
		expect(context.tagType).toBe("genre")
		expect(context.input).toBe("")
		expect(context.indexSuggestion).toBe(0)
		expect(tagsActiveAtom.get()).toEqual(["rock"])
		expect(suggestionsAtom.get()).toEqual([])
	})

	it("switchTagType changes type, clears input, resets index", () => {
		const quickEdit = createState({ defaultTagType: "mood" })
		quickEdit.state.trigger.setInput({ input: "search" })
		quickEdit.state.trigger.setSuggestionsIndex({ index: 5 })

		quickEdit.state.trigger.switchTagType({ tagType: "genre" })

		const context = getContext(quickEdit)
		expect(context.tagType).toBe("genre")
		expect(context.input).toBe("")
		expect(context.indexSuggestion).toBe(0)
	})

	it("setInput updates input", () => {
		const quickEdit = createState()

		quickEdit.state.trigger.setInput({ input: "electronic" })

		expect(getContext(quickEdit).input).toBe("electronic")
	})

	it("addTagFromInput appends to current type, clears input, resets index", () => {
		const quickEdit = createState({
			appliedTags: { mood: ["chill"], genre: [] },
			defaultTagType: "mood"
		})
		quickEdit.state.trigger.setInput({ input: "happy" })
		quickEdit.state.trigger.setSuggestionsIndex({ index: 3 })

		quickEdit.state.trigger.addTagFromInput({ input: "happy" })

		const context = getContext(quickEdit)
		expect(context.tagsApplied.mood).toEqual(["chill", "happy"])
		expect(context.tagsApplied.genre).toEqual([])
		expect(context.input).toBe("")
		expect(context.indexSuggestion).toBe(0)
	})

	it("addTagFromInput across types preserves both", () => {
		const quickEdit = createState()

		quickEdit.state.trigger.addTagFromInput({ input: "chill" })
		quickEdit.state.trigger.switchTagType({ tagType: "genre" })
		quickEdit.state.trigger.addTagFromInput({ input: "rock" })

		const context = getContext(quickEdit)
		expect(context.tagsApplied.mood).toEqual(["chill"])
		expect(context.tagsApplied.genre).toEqual(["rock"])
	})

	it("setActiveTags replaces only the current type", () => {
		const quickEdit = createState({
			appliedTags: { mood: ["chill"], genre: ["rock"] },
			defaultTagType: "mood"
		})

		quickEdit.state.trigger.setActiveTags({ tags: ["happy", "sad"] })

		const context = getContext(quickEdit)
		expect(context.tagsApplied.mood).toEqual(["happy", "sad"])
		expect(context.tagsApplied.genre).toEqual(["rock"])
	})

	it("suggestionsAtom filters by input and excludes applied tags", () => {
		const quickEdit = createState({
			suggestions: {
				mood: ["chill", "cheerful", "dark", "dreamy"],
				genre: []
			},
			appliedTags: { mood: ["chill"], genre: [] },
			defaultTagType: "mood"
		})

		// refactor use constants instead of duplicating values. Update claude.md and other code
		expect(quickEdit.suggestionsAtom.get()).toEqual([
			"cheerful",
			"dark",
			"dreamy"
		])

		quickEdit.state.trigger.setInput({ input: "ch" })
		expect(quickEdit.suggestionsAtom.get()).toEqual(["cheerful"])
	})

	it("tagsActiveAtom follows tag type switches", () => {
		const quickEdit = createState({
			appliedTags: { mood: ["chill"], genre: ["rock"] },
			defaultTagType: "mood"
		})

		expect(quickEdit.tagsActiveAtom.get()).toEqual(["chill"])

		quickEdit.state.trigger.switchTagType({ tagType: "genre" })
		expect(quickEdit.tagsActiveAtom.get()).toEqual(["rock"])
	})
})
