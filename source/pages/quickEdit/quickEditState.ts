// I could create a stream which fetches the genre and moods via combine latest,
// and then maps those to the store
// and ultimately returning the store wrapped in a QueryResult.
// However, I am not sure if this is the best way.
// Doesnt feel like it.
// I could create the store and the queries in parallel,
// and when a query completes, I update the store.
// But thats kinda imperative..

import { createAtom, createStore } from "@xstate/store"
import { useAtom } from "@xstate/store/react"
import { create } from "mutative"
import { useRef } from "react"
import { appConfig } from "#/config/config"
import type { TagType } from "#/config/config"
import type { BaseTrack } from "#/database/types"

export type SuggestionsRecord = Record<TagType, readonly string[]>

type QuickEditStateStore = {
	input: string
	tagsApplied: SuggestionsRecord
	tagsSuggested: SuggestionsRecord
	indexSuggestion: number
	tagType: TagType
}

export function useQuickEditState(
	track: BaseTrack,
	suggestions: SuggestionsRecord
) {
	const stateRef = useRef<ReturnType<typeof createQuickEditState>>(null)
	if (!stateRef.current) {
		stateRef.current = createQuickEditState({
			appliedMood: track.mood ?? [],
			appliedGenre: track.genre ?? [],
			suggestions
		})
	}
	const state = stateRef.current

	const suggestionsFiltered = useAtom(state.suggestionsAtom)
	const tagsActive = useAtom(state.tagsActiveAtom)

	// 	useEffect(()=> {
	// 		// database.getCoOccurenceGenres
	// 		//

	// Promise.all		(
	// 	[
	// 		Promise.resolve(["mood 1", "mood 2", "mood 3"]),
	// 		Promise.resolve( ["genre 1", "genre 2", "genre 3"])
	// 	]
	// 		).then(([moods, genres])=> stateRef.current?.state.trigger.setActiveTags())

	// 	}, [track])

	return {
		state: stateRef.current.state,
		suggestions: suggestionsFiltered,
		tagsActive
	}
}

const initalState: QuickEditStateStore = {
	input: "",
	tagsSuggested: { genre: [], mood: [] },
	tagsApplied: { genre: [], mood: [] },
	indexSuggestion: 0,
	tagType: appConfig.quickEdit.defaultTagType
}

// And manual work, but probably the easiest.
function createQuickEditState({
	appliedGenre,
	appliedMood,
	suggestions
}: {
	appliedGenre: readonly string[]
	appliedMood: readonly string[]
	suggestions: SuggestionsRecord
}) {
	const state = createStore({
		context: {
			...initalState,
			tagsSuggested: suggestions,
			tagsApplied: {
				genre: appliedGenre,
				mood: appliedMood
			}
		} satisfies QuickEditStateStore,
		on: {
			switchTagType: (context, { tagType }: { tagType: TagType }) => ({
				...context,
				tagType,
				input: "",
				indexSuggestion: 0
			}),

			setInput: (context, { input }: { input: string }) => ({
				...context,
				input
			}),

			addTagFromInput: (context, { input }: { input: string }) =>
				create(context, (draft) => {
					draft.tagsApplied[draft.tagType].push(input)
					draft.indexSuggestion = 0
					draft.input = ""
				}),

			setSuggestions: (
				context,
				{ suggestions, type }: { type: TagType; suggestions: string[] }
			) =>
				create(context, (draft) => {
					draft.tagsSuggested[type] = suggestions
				}),

			setActiveTags: (context, { tags }: { tags: string[] }) =>
				create(context, (draft) => {
					draft.tagsApplied[draft.tagType] = tags
				}),

			setSuggestionsIndex: (context, { index }: { index: number }) => ({
				...context,
				indexSuggestion: index
			})
		}
	})

	const suggestionsAtom = createAtom((read) => {
		const { context } = read(state)
		const type = context.tagType
		const applied = context.tagsApplied[type]
		const input = context.input.toLowerCase()
		const suggestionsAll = context.tagsSuggested[type]
		const filtered = suggestionsAll.filter(
			(suggestion) =>
				suggestion.toLowerCase().includes(input)
				&& !applied.includes(suggestion)
		)

		return filtered
	})

	const tagsActiveAtom = createAtom((read) => {
		const {
			context: { tagType, tagsApplied }
		} = read(state)

		return tagsApplied[tagType]
	})

	return {
		state,
		suggestionsAtom,
		tagsActiveAtom
	}
}
