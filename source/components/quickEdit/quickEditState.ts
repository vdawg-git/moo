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
import { Result } from "typescript-result"
import { appConfig, type TagType } from "#/config/config"
import { useQuery } from "#/database/useQuery"
import type { BaseTrack } from "#/database/types"

type SuggestionsStore = Record<TagType, readonly string[]>

type QuickEditStateStore = {
	input: string
	tagsApplied: SuggestionsStore
	tagsSuggested: SuggestionsStore
	indexSuggestion: number
	tagType: TagType
}

export function useQuickEditState(track: BaseTrack) {
	const queryMoods = useQuery(["moods", track.id], async () =>
		Result.ok(["mood 1", "mood 2", "mood 3"])
	)
	const queryGenres = useQuery(["genre", track.id], async () =>
		Result.ok(["genre 1", "genre 2", "genre 3"])
	)

	const stateRef = useRef<ReturnType<typeof createQuickEditState>>(null)
	if (!stateRef.current) {
		stateRef.current = createQuickEditState({
			suggestionsMood: queryMoods.data?.getOrDefault([]) ?? [],
			suggestionsGenre: queryGenres.data?.getOrDefault([]) ?? [],
			track
		})
	}
	const state = stateRef.current

	const suggestions = useAtom(state.suggestionsAtom)
	const tagsActive = useAtom(state.tagsActiveAtom)

	return {
		state: stateRef.current.state,
		suggestions,
		tagsActive,
		queryMoods,
		queryGenres
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
	track,
	suggestionsGenre,
	suggestionsMood
}: {
	track: BaseTrack
	suggestionsGenre: readonly string[]
	suggestionsMood: readonly string[]
}) {
	const state = createStore({
		context: {
			...initalState,
			...{
				tagsSuggested: {
					genre: suggestionsGenre,
					mood: suggestionsMood
				},
				tagsApplied: {
					genre: track.genre ?? [],
					mood: track.mood ?? []
				}
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
		const input = context.input.toLowerCase()
		const suggestionsAll = context.tagsSuggested[type]
		const filtered = suggestionsAll.filter((suggestion) =>
			suggestion.toLowerCase().includes(input)
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
