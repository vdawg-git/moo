import path from "node:path"
import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useSelector } from "@xstate/store/react"
import { type ReactNode, useEffect } from "react"
import * as R from "remeda"
import { useColors } from "#/hooks/useColors"
import { useFocusItems, useFocusItemsKeybings } from "#/hooks/useFocusItems"
import { BracketButton } from "../button"
import { Input } from "../Input"
import { Select } from "../select"
import { useQuickEditState } from "./quickEditState"
import type { TagType } from "#/config/config"
import type { BaseTrack } from "#/database/types"
import type { AppModalContentProps } from "#/state/types"

type QuickEditModalProps = {
	modal: AppModalContentProps
	track: BaseTrack
}

type Focusable = "input" | "suggestions" | "tagType"
const focusedDisplayList = [
	"tagType",
	"input",
	"suggestions"
] as const satisfies Focusable[]

// This is kinda ugly, but I wanted to keep it simple for once
export function QuickEditModal({ track, modal }: QuickEditModalProps) {
	const { state, suggestions, tagsActive } = useQuickEditState(track)

	/** 0 = tagType, 1 = input, 2 = suggestion */
	const { focused, goNext, goPrevious } = useFocusItems({
		itemsAmount: 3,
		initialIndex: 1
	})
	const focusedDisplay = focusedDisplayList[focused]

	const tagType = useSelector(state, ({ context }) => context.tagType)
	const input = useSelector(state, ({ context }) => context.input)
	const indexSuggestion = useSelector(
		state,
		({ context }) => context.indexSuggestion
	)

	// I need to be able to:
	// - switch between genre and mood.
	// - Add, remove from the tag list.
	// - Quickly select from tags, ideally with auto-complete.
	//   - And a select component for quick selection.
	// - Hitting escape saves the tags.
	// - Hitting X closes without saving.
	// - Get all moods and genres. Display them in the suggestions
	// Use default tag type for inital selection
	//
	const title = track.title ?? path.basename(track.id)

	useKeyboard((keypress) => {
		if (keypress.name === "tab") {
			const goBack = keypress.shift
			if (goBack) {
				goPrevious()
			} else {
				goNext()
			}
		}

		if (focusedDisplay === "tagType" && keypress.name === "return") {
			const current = state.get().context.tagType
			state.trigger.switchTagType({
				tagType: current === "mood" ? "genre" : "mood"
			})
			return
		}

		if (keypress.name === "escape") {
			// Save the result to the file, update db
			// do I need to call the db, or will it see the file change and update by itself?
			// Do I have watching set to optional in the config?
			modal.closeModal()
		}

		// close without saving
		// but x is already taken hhh
		if (keypress.name === "x" && keypress.shift) {
			modal.closeModal()
		}
	})

	return (
		<box>
			<text>Track: {title}</text>

			<TagTabs
				focused={focusedDisplay === "tagType"}
				activeType={tagType}
				onChange={(type) => state.trigger.switchTagType({ tagType: type })}
			/>

			<TagsInput
				items={tagsActive}
				input={input}
				onChange={(value) => state.trigger.setInput({ input: value })}
				onSubmit={(items) => state.trigger.setActiveTags({ tags: items })}
				focused={focusedDisplay === "input"}
			/>

			<Suggestions
				index={indexSuggestion}
				focused={focusedDisplay === "suggestions"}
				suggestions={suggestions}
				onIndexChange={(index) => state.trigger.setSuggestionsIndex({ index })}
				onSelect={(suggestion) => {
					state.trigger.setActiveTags({ tags: [...tagsActive, suggestion] })
				}}
			/>
		</box>
	)
}

function TagsInput({
	focused: hasFocus,
	items,
	onChange,
	onSubmit,
	input
}: {
	input: string
	focused: boolean
	items: readonly string[]
	onChange: (input: string) => void
	onSubmit: (items: string[]) => void
}): ReactNode {
	const lastIndex = items.length - 1
	const focusItemsReturn = useFocusItems({
		itemsAmount: items.length,
		initialIndex: lastIndex
	})
	const { focused: focusedRaw, setFocus } = focusItemsReturn

	useFocusItemsKeybings({ focusReturn: focusItemsReturn, enabled: hasFocus })

	const focused = hasFocus ? focusedRaw : undefined
	const isInputFocused = focused && focused >= items.length

	const colors = useColors()

	useKeyboard((key) => {
		if (key.name === "x" && focused && !isInputFocused) {
			const newItems = R.splice(items, focused, 1, [])
			onSubmit(newItems)
			return
		}
	})

	return (
		<box flexDirection="row" flexWrap="wrap">
			{items.map((item, index) => {
				const isFocused = index === focused

				return (
					<box
						key={item}
						border={["left", "right"]}
						borderColor={isFocused ? colors.blue : colors.black}
						onMouseDown={() => setFocus(index)}
					>
						<text
							fg={isFocused ? colors.blue : colors.fg}
							attributes={isFocused ? TextAttributes.NONE : TextAttributes.DIM}
						>
							{item}
						</text>
					</box>
				)
			})}

			<Input
				value={input}
				focused={focused === lastIndex}
				onMouseDown={() => setFocus(lastIndex)}
				onChange={onChange}
				onSubmit={(value) => onSubmit([...items, value])}
			/>
		</box>
	)
}

const tagTypesList: { type: TagType; label: string }[] = [
	{ type: "mood", label: "Mood" },
	{ type: "genre", label: "Genre" }
]

function TagTabs({
	onChange,
	focused,
	activeType
}: {
	activeType: TagType
	focused: boolean
	onChange: (tagType: TagType) => void
}) {
	const colors = useColors()
	const focusReturn = useFocusItems({ itemsAmount: tagTypesList.length })
	useFocusItemsKeybings({ enabled: focused, focusReturn })

	useEffect(() => {
		const tagType = tagTypesList[focusReturn.focused]!.type
		onChange(tagType)
	}, [focusReturn.focused, onChange])

	return (
		<box
			border
			borderStyle="rounded"
			borderColor={focused ? colors.blue : colors.black}
			padding={0}
			flexDirection="row"
			gap={1}
		>
			{tagTypesList.map(({ type, label }) => {
				const isActive = activeType === type
				const foreground = isActive ? colors.blue : colors.fg

				return (
					<BracketButton
						key={type}
						fg={foreground}
						onMouseDown={() => onChange(type)}
					>
						{label}
					</BracketButton>
				)
			})}
		</box>
	)
}

function Suggestions({
	suggestions,
	onSelect,
	focused: hasFocus,
	index
}: {
	index: number
	focused: boolean
	suggestions: string[]
	onIndexChange: (index: number) => void
	onSelect: (suggestion: string) => void
}) {
	const colors = useColors()

	return (
		<Select
			focused={hasFocus}
			options={suggestions.map((suggestion) => ({
				name: suggestion,
				description: suggestion,
				value: suggestion
			}))}
			onSelect={(_, suggestion) => suggestion && onSelect(suggestion.name)}
			focusedTextColor={colors.blue}
			backgroundColor={colors.bg}
			focusedBackgroundColor={hasFocus ? colors.black : colors.bg}
			textColor={colors.fg}
			selectedIndex={index}
		/>
	)
}
