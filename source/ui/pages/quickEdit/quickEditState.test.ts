import { describe, expect, it } from "bun:test"
import { createQuickEditState } from "./quickEditState"
import type { SuggestionsRecord } from "./quickEditState"

const moodSuggestions = ["chill", "cheerful", "dark", "dreamy"] as const

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

		expect(context.tagsApplied, "preserves applied tags").toEqual({
			mood: ["chill"],
			genre: ["rock"]
		})
		expect(context.tagType, "defaults to genre").toBe("genre")
		expect(context.input, "input starts empty").toBe("")
		expect(context.indexSuggestion, "suggestion index starts at 0").toBe(0)
		expect(tagsActiveAtom.get(), "active tags match genre").toEqual(["rock"])
		expect(suggestionsAtom.get(), "no suggestions without match").toEqual([])
	})

	it("switchTagType changes type, clears input, resets index", () => {
		const quickEdit = createState({ defaultTagType: "mood" })
		quickEdit.state.trigger.setInput({ input: "search" })
		quickEdit.state.trigger.setSuggestionsIndex({ index: 5 })

		quickEdit.state.trigger.switchTagType({ tagType: "genre" })

		const context = getContext(quickEdit)
		expect(context.tagType, "switched to genre").toBe("genre")
		expect(context.input, "input cleared").toBe("")
		expect(context.indexSuggestion, "index reset").toBe(0)
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
		expect(context.tagsApplied.mood, "mood tags appended").toEqual([
			"chill",
			"happy"
		])
		expect(context.tagsApplied.genre, "genre tags unchanged").toEqual([])
		expect(context.input, "input cleared").toBe("")
		expect(context.indexSuggestion, "index reset").toBe(0)
	})

	it("addTagFromInput across types preserves both", () => {
		const quickEdit = createState()

		quickEdit.state.trigger.addTagFromInput({ input: "chill" })
		quickEdit.state.trigger.switchTagType({ tagType: "genre" })
		quickEdit.state.trigger.addTagFromInput({ input: "rock" })

		const context = getContext(quickEdit)
		expect(context.tagsApplied.mood, "mood preserved").toEqual(["chill"])
		expect(context.tagsApplied.genre, "genre preserved").toEqual(["rock"])
	})

	it("setActiveTags replaces only the current type", () => {
		const quickEdit = createState({
			appliedTags: { mood: ["chill"], genre: ["rock"] },
			defaultTagType: "mood"
		})

		quickEdit.state.trigger.setActiveTags({ tags: ["happy", "sad"] })

		const context = getContext(quickEdit)
		expect(context.tagsApplied.mood, "mood replaced").toEqual(["happy", "sad"])
		expect(context.tagsApplied.genre, "genre unchanged").toEqual(["rock"])
	})

	it("suggestionsAtom filters by input and excludes applied tags", () => {
		const quickEdit = createState({
			suggestions: {
				mood: [...moodSuggestions],
				genre: []
			},
			appliedTags: { mood: ["chill"], genre: [] },
			defaultTagType: "mood"
		})

		expect(quickEdit.suggestionsAtom.get(), "excludes applied 'chill'").toEqual(
			["cheerful", "dark", "dreamy"]
		)

		quickEdit.state.trigger.setInput({ input: "ch" })
		expect(quickEdit.suggestionsAtom.get(), "filtered by 'ch'").toEqual([
			"cheerful"
		])
	})

	it("tagsActiveAtom follows tag type switches", () => {
		const quickEdit = createState({
			appliedTags: { mood: ["chill"], genre: ["rock"] },
			defaultTagType: "mood"
		})

		expect(quickEdit.tagsActiveAtom.get(), "shows mood initially").toEqual([
			"chill"
		])

		quickEdit.state.trigger.switchTagType({ tagType: "genre" })
		expect(quickEdit.tagsActiveAtom.get(), "shows genre after switch").toEqual([
			"rock"
		])
	})

	it("indexApplied initializes to 0 and updates via setAppliedIndex", () => {
		const quickEdit = createState()
		expect(getContext(quickEdit).indexApplied, "should initialize at 0").toBe(0)

		quickEdit.state.trigger.setAppliedIndex({ index: 3 })
		expect(getContext(quickEdit).indexApplied, "should update to index 3").toBe(
			3
		)
	})

	it("setActiveTags clamps indexApplied when tags shrink", () => {
		const quickEdit = createState({
			appliedTags: { mood: ["a", "b", "c"], genre: [] },
			defaultTagType: "mood"
		})
		quickEdit.state.trigger.setAppliedIndex({ index: 2 })

		quickEdit.state.trigger.setActiveTags({ tags: ["a"] })

		expect(getContext(quickEdit).indexApplied).toBe(0)
	})

	it("switchTagType resets indexApplied to 0", () => {
		const quickEdit = createState({ defaultTagType: "mood" })
		quickEdit.state.trigger.setAppliedIndex({ index: 5 })

		quickEdit.state.trigger.switchTagType({ tagType: "genre" })

		expect(getContext(quickEdit).indexApplied).toBe(0)
	})
})
