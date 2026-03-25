import { createAtom, createStore } from "@xstate/store"
import { useAtom } from "@xstate/store/react"
import { create } from "mutative"
import { useRef } from "react"
import type { BaseTrack } from "#/ports/database"
import type { TagType } from "#/shared/config/config"

export type SuggestionsRecord = Record<TagType, readonly string[]>

type QuickEditStateStore = {
	input: string
	tagsApplied: SuggestionsRecord
	tagsSuggested: SuggestionsRecord
	indexSuggestion: number
	indexApplied: number
	tagType: TagType
}

export function useQuickEditState(
	track: BaseTrack,
	suggestions: SuggestionsRecord,
	defaultTagType: TagType
) {
	const stateRef = useRef<ReturnType<typeof createQuickEditState>>(null)
	if (!stateRef.current) {
		stateRef.current = createQuickEditState({
			appliedTags: {
				mood: track.mood ?? [],
				genre: track.genre ?? []
			},
			suggestions,
			defaultTagType
		})
	}
	const state = stateRef.current

	const suggestionsFiltered = useAtom(state.suggestionsAtom)
	const tagsActive = useAtom(state.tagsActiveAtom)

	return {
		state: stateRef.current.state,
		suggestions: suggestionsFiltered,
		tagsActive
	}
}

export function createQuickEditState({
	appliedTags,
	suggestions,
	defaultTagType
}: {
	appliedTags: SuggestionsRecord
	suggestions: SuggestionsRecord
	defaultTagType: TagType
}) {
	const initalState: QuickEditStateStore = {
		input: "",
		tagsSuggested: { genre: [], mood: [] },
		tagsApplied: { genre: [], mood: [] },
		indexSuggestion: 0,
		indexApplied: 0,
		tagType: defaultTagType
	}
	const state = createStore({
		context: {
			...initalState,
			tagsSuggested: suggestions,
			tagsApplied: appliedTags
		} satisfies QuickEditStateStore,
		on: {
			switchTagType: (context, { tagType }: { tagType: TagType }) => ({
				...context,
				tagType,
				input: "",
				indexSuggestion: 0,
				indexApplied: 0
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
					draft.indexApplied = Math.min(
						draft.indexApplied,
						Math.max(tags.length - 1, 0)
					)
				}),

			setSuggestionsIndex: (context, { index }: { index: number }) => ({
				...context,
				indexSuggestion: index
			}),

			setAppliedIndex: (context, { index }: { index: number }) => ({
				...context,
				indexApplied: index
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
