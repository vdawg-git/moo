import path from "node:path"
import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useSelector } from "@xstate/store/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Result } from "typescript-result"
import { Dialog } from "#/components/dialog"
import { ErrorScreen } from "#/components/errorScreen"
import { appConfig, type TagType } from "#/config/config"
import { database } from "#/database/database"
import { useQuery } from "#/database/useQuery"
import { useColors } from "#/hooks/useColors"
import { useFocusItems, useFocusItemsKeybings } from "#/hooks/useFocusItems"
import { updateFileTags } from "#/localFiles/localFiles"
import { createQueryKey } from "#/queryKey"
import { addErrorNotification, appState } from "#/state/state"
import { BracketButton } from "../../components/button"
import { Input } from "../../components/Input"
import { Select } from "../../components/select"
import { type SuggestionsRecord, useQuickEditState } from "./quickEditState"
import type { BaseTrack, TrackId } from "#/database/types"

type QuickEditPageProps = {
	id: TrackId
}

const focusedDisplayList = [
	"tagType",
	"input",
	"suggestions",
	"applied"
] as const
type Focused = (typeof focusedDisplayList)[number]
const focusedEnum = focusedDisplayList.reduce(
	(accumulator, label, index) => {
		accumulator[label] = index
		return accumulator
	},
	{} as Record<Focused, number>
)

// This is kinda ugly, but I wanted to keep it simple for once
export function QuickEditPage({ id }: QuickEditPageProps) {
	const quickEditQuery = useQuery<QuickEditorProps>(
		createQueryKey.quickEdit(id),
		async () =>
			Result.all(database.getTrack(id), database.getCoOccurenceTags(id)).map(
				([track, suggestions]) => ({
					track,
					suggestions: {
						mood: suggestions.moods.map(({ name }) => name),
						genre: suggestions.genre.map(({ name }) => name)
					}
				})
			)
	)

	return quickEditQuery.data?.fold(
		(props) => <QuickEditEditor {...props} />,
		(error) => <ErrorScreen error={error} />
	)
}

type QuickEditorProps = {
	track: BaseTrack
	suggestions: SuggestionsRecord
}

function QuickEditEditor({
	track,
	suggestions: suggestionsUnfiltered
}: QuickEditorProps) {
	const { state, suggestions, tagsActive } = useQuickEditState(
		track,
		suggestionsUnfiltered
	)
	const [isCloseModalOpen, setCloseModalOpen] = useState(false)

	/** 0 = tagType, 1 = input, 2 = suggestion, 3 = applied tags */
	const { focused, goNext, goPrevious, setFocus } = useFocusItems({
		itemsAmount: focusedDisplayList.length,
		initialIndex: 1
	})
	const focusedDisplay = focusedDisplayList[focused]

	const tagType = useSelector(state, ({ context }) => context.tagType)
	const input = useSelector(state, ({ context }) => context.input)
	const indexSuggestion = useSelector(
		state,
		({ context }) => context.indexSuggestion
	)

	const title = track.title ?? path.basename(track.id)

	useKeyboard((keypress) => {
		if (isCloseModalOpen) return

		if (keypress.name === "tab") {
			const goBack = keypress.shift
			if (goBack) {
				goPrevious()
			} else {
				goNext()
			}
		}

		if (focused === focusedEnum.input) {
			if (keypress.name === "escape" || keypress.name === "down") {
				goNext()
				return
			}

			if (keypress.name === "up") {
				goPrevious()
				return
			}
		}

		if (focused === focusedEnum.input) return

		if (focusedDisplay === "tagType" && keypress.name === "return") {
			const current = state.get().context.tagType
			state.trigger.switchTagType({
				tagType: current === "mood" ? "genre" : "mood"
			})
			return
		}

		if (keypress.name === "escape" && !isCloseModalOpen) {
			setCloseModalOpen(true)
			return
		}

		const pressedNumber = keypress.number && Number(keypress.name)
		if (
			pressedNumber &&
			pressedNumber !== 0 &&
			pressedNumber <= focusedDisplayList.length
		) {
			setFocus(pressedNumber - 1)
			return
		}
	})

	const colors = useColors()

	return (
		<>
			<box height={"100%"} width={"100%"}>
				<box flexDirection="row" width={"100%"} justifyContent="space-between">
					<text fg={colors.blue} height={1}>
						{appConfig.icons.edit}
						{"  "}
						{title}
						{" - "}
						{track.artist ?? track.albumartist ?? "(unknown artist)"}
					</text>

					<text
						onMouseDown={() => setCloseModalOpen(true)}
						fg={colors.fg}
						attributes={TextAttributes.DIM}
					>
						[ESC] Go back
					</text>
				</box>

				<box flexDirection="row" height={"100%"} width={"100%"}>
					<box maxWidth={"50%"} flexShrink={1}>
						<TagTabs
							focused={focusedDisplay === "tagType"}
							activeType={tagType}
							onChange={(type) =>
								state.trigger.switchTagType({ tagType: type })
							}
						/>

						<TagsInput
							input={input}
							onChange={(value) => state.trigger.setInput({ input: value })}
							onSubmit={(input) => state.trigger.addTagFromInput({ input })}
							focused={focusedDisplay === "input"}
							onFocus={() => setFocus(3)}
							title={`[2] Search for ${tagType}`}
							placeholder={`Search ${tagType}..`}
							onGoNext={goNext}
							onGoPrevious={goPrevious}
						/>

						<Suggestions
							index={indexSuggestion}
							focused={focusedDisplay === "suggestions"}
							suggestions={suggestions}
							onIndexChange={(index) =>
								state.trigger.setSuggestionsIndex({ index })
							}
							onSelect={(suggestion) => {
								state.trigger.setActiveTags({
									tags: [...tagsActive, suggestion]
								})
							}}
						/>
					</box>

					<AppliedSuggestions
						title={`[4] Applied ${tagType}`}
						items={tagsActive}
						focused={focusedDisplay === "applied"}
						onChange={(tags) => {
							state.trigger.setActiveTags({ tags })
						}}
					/>
				</box>
			</box>

			<Dialog
				open={isCloseModalOpen}
				onClose={() => {
					setCloseModalOpen(false)
				}}
			>
				<CloseDialogContent
					onExit={async () => {
						try {
							await updateFileTags({ id: track.id, [tagType]: tagsActive })
							appState.trigger.goBackOrHome()
						} catch (error) {
							addErrorNotification("Failed to update file tags", error)
						}
					}}
					onExitNoSave={() => appState.trigger.goBackOrHome()}
				/>
			</Dialog>
		</>
	)
}

function TagsInput({
	focused: hasFocus,
	onChange,
	onSubmit,
	input,
	onFocus,
	placeholder,
	title,
	onGoNext,
	onGoPrevious
}: {
	input: string
	focused: boolean
	onChange: (input: string) => void
	onSubmit: (input: string) => void
	onFocus: () => void
	onGoNext: () => void
	onGoPrevious: () => void
	placeholder: string
	title: string
}): ReactNode {
	const colors = useColors()

	return (
		<box
			flexDirection="row"
			flexWrap="wrap"
			title={title}
			border
			borderStyle="rounded"
			height={3}
			borderColor={hasFocus ? colors.blue : colors.brightBlack}
		>
			<Input
				value={input}
				focused={hasFocus}
				onMouseDown={onFocus}
				onInput={onChange}
				onKeyDown={(key) => {
					if (key.name === "down") {
						onGoNext()
					}
					if (key.name === "up") {
						onGoPrevious()
					}
				}}
				placeholder={placeholder}
				width={"100%"}
				onSubmit={onSubmit}
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

	const onChangeRef = useRef(onChange)
	onChangeRef.current = onChange

	useEffect(() => {
		const tagType = tagTypesList[focusReturn.focused]!.type
		onChangeRef.current(tagType)
	}, [focusReturn.focused])

	return (
		<box
			title="[1] Tag"
			border
			borderStyle="rounded"
			borderColor={focused ? colors.blue : colors.brightBlack}
			padding={0}
			flexDirection="row"
			gap={1}
		>
			{tagTypesList.map(({ type, label }, index) => {
				const isActive = activeType === type
				const foreground = isActive ? colors.blue : colors.fg

				return (
					<BracketButton
						key={type}
						fg={foreground}
						onMouseDown={() => focusReturn.setFocus(index)}
						attributes={focused || isActive ? undefined : TextAttributes.DIM}
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
		<box
			title="[3] Suggestions"
			width={"100%"}
			height={"100%"}
			border
			borderStyle="rounded"
			borderColor={hasFocus ? colors.blue : colors.brightBlack}
		>
			{suggestions.length > 0 ? (
				<Select
					focused={hasFocus}
					options={suggestions.map((suggestion) => ({
						name: suggestion,
						description: suggestion,
						value: suggestion
					}))}
					onSelect={(_, suggestion) => suggestion && onSelect(suggestion.name)}
					focusedTextColor={colors.fg}
					backgroundColor={colors.bg}
					focusedBackgroundColor={colors.bg}
					textColor={colors.brightBlack}
					selectedIndex={index}
					showDescription={false}
					height={suggestions.length + 1}
					selectedTextColor={colors.yellow}
					selectedBackgroundColor={colors.bg}
				/>
			) : (
				<text fg={colors.fg} attributes={TextAttributes.DIM}>
					No results
				</text>
			)}
		</box>
	)
}

function AppliedSuggestions({
	focused: hasFocus,
	items,
	onChange,
	title
}: {
	focused: boolean
	items: readonly string[]
	onChange: (items: string[]) => void
	title: string
}): ReactNode {
	const colors = useColors()
	const focusReturn = useFocusItems({ itemsAmount: items.length })
	const index = focusReturn.focused
	useFocusItemsKeybings({ enabled: hasFocus, focusReturn })

	useKeyboard((key) => {
		if (key.name === "x") {
			const newItems = items.filter((_, jindex) => jindex !== index)
			onChange(newItems)
		}
	})

	const onChangeRef = useRef(onChange)
	onChangeRef.current = onChange

	return (
		<box
			title={title}
			border
			borderStyle="rounded"
			borderColor={hasFocus ? colors.blue : colors.brightBlack}
			minWidth={20}
			height={"100%"}
			flexShrink={2}
			width={"100%"}
		>
			<box height={"100%"} width={"100%"} flexDirection="row" flexWrap="wrap">
				{items.map((item, index) => {
					const isFocused = index === focusReturn.focused

					return (
						<box
							key={item}
							onMouseDown={() => focusReturn.setFocus(index)}
							width={"auto"}
							flexDirection="row"
							gap={1}
						>
							<text
								fg={hasFocus && isFocused ? colors.blue : colors.fg}
								attributes={hasFocus ? TextAttributes.NONE : TextAttributes.DIM}
								width={"auto"}
							>
								<b>(</b>
								{item}
								<b>)</b>
							</text>
						</box>
					)
				})}
			</box>

			<box>
				<text
					fg={colors.fg}
					attributes={hasFocus ? TextAttributes.NONE : TextAttributes.DIM}
				>
					<span
						fg={hasFocus ? colors.bg : colors.fg}
						bg={hasFocus ? colors.fg : colors.bg}
					>
						{" X "}
					</span>{" "}
					Remove
				</text>
			</box>
		</box>
	)
}

function CloseDialogContent({
	onExit,
	onExitNoSave
}: {
	onExit: () => Promise<void> | void
	onExitNoSave: () => Promise<void> | void
}): ReactNode {
	useKeyboard(async (key) => {
		if (key.name === "return") {
			onExit()
		}

		if (key.name === "x") {
			onExitNoSave()
		}
	})

	return (
		<box>
			<text>Exit?</text>
			<text>[Enter] Save and exit</text>
			<text>[X] Exit without saving</text>
			<text>[ESC] Cancel</text>
		</box>
	)
}
