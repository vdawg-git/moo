import path from "node:path"
import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useSelector } from "@xstate/store/react"
import { useRef, useState } from "react"
import { Result } from "typescript-result"
import { useAppContext } from "#/app/context"
import { useConfig } from "#/shared/config/configContext"
import { createQueryKey } from "#/shared/queryKey"
import { Dialog } from "#/ui/components/dialog"
import { ErrorScreen } from "#/ui/components/errorScreen"
import { Playbar } from "#/ui/components/playbar"
import { useColors } from "#/ui/hooks/useColors"
import { useFocusZones } from "#/ui/hooks/useFocusZone"
import { useIcons } from "#/ui/hooks/useIcons"
import { useQuery } from "#/ui/hooks/useQuery"
import { useCurrentTrack, usePlayState } from "#/ui/hooks/useSelectors"
import { BracketButton } from "../../components/button"
import { Input } from "../../components/Input"
import { Select } from "../../components/select"
import { useQuickEditState } from "./quickEditState"
import type { InputProps } from "@opentui/react"
import type { BaseTrack, TrackId } from "#/ports/database"
import type { TagType } from "#/shared/config/config"
import type { ReactNode } from "react"
import type { SuggestionsRecord } from "./quickEditState"

type QuickEditPageProps = {
	id: TrackId
}

export function QuickEditPage({ id }: QuickEditPageProps) {
	const { database } = useAppContext()
	const quickEditQuery = useQuery<QuickEditorProps>(
		createQueryKey.quickEdit(id),
		async () =>
			Result.all(database.getTrack(id), database.getCoOccurenceTags(id)).map(
				([track, suggestions]) => ({
					track,
					suggestions: {
						mood: suggestions.mood.map(({ name }) => name),
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
	const { appState, notifications, musicLibrary } = useAppContext()
	const config = useConfig()
	const { state, suggestions, tagsActive } = useQuickEditState(
		track,
		suggestionsUnfiltered,
		config.quickEdit.defaultTagType
	)
	const [isCloseModalOpen, setCloseModalOpen] = useState(false)

	const tagType = useSelector(state, ({ context }) => context.tagType)
	const input = useSelector(state, ({ context }) => context.input)
	const indexSuggestion = useSelector(
		state,
		({ context }) => context.indexSuggestion
	)

	const indexApplied = useSelector(state, ({ context }) => context.indexApplied)

	const suggestionsRef = useRef(suggestions)
	suggestionsRef.current = suggestions
	const tagsActiveRef = useRef(tagsActive)
	tagsActiveRef.current = tagsActive

	const { isActive } = useFocusZones({
		zones: [
			{
				name: "tagType",
				callbacks: {
					accept: () => {
						const current = state.get().context.tagType
						state.trigger.switchTagType({
							tagType: current === "mood" ? "genre" : "mood"
						})
					},
					abort: () => setCloseModalOpen(true)
				},
				neighbors: { down: "input", right: "applied" }
			},
			{
				name: "input",
				isInput: true,
				callbacks: {
					accept: () => {
						const currentInput = state.get().context.input
						if (currentInput) {
							state.trigger.addTagFromInput({ input: currentInput })
						}
					},
					abort: ({ setZone }) => setZone("suggestions")
				},
				neighbors: { up: "tagType", down: "suggestions" }
			},
			{
				name: "suggestions",
				arrows: ["up", "down"],
				callbacks: {
					accept: () => {
						const currentIndex = state.get().context.indexSuggestion
						const suggestion = suggestionsRef.current[currentIndex]
						if (suggestion) {
							state.trigger.setActiveTags({
								tags: [...tagsActiveRef.current, suggestion]
							})
						}
					},
					abort: () => setCloseModalOpen(true),
					"quickEdit.nextSuggestion": () => {
						const currentIndex = state.get().context.indexSuggestion
						const maxIndex = suggestionsRef.current.length - 1
						state.trigger.setSuggestionsIndex({
							index: Math.min(currentIndex + 1, maxIndex)
						})
					},
					"quickEdit.previousSuggestion": () => {
						const currentIndex = state.get().context.indexSuggestion
						state.trigger.setSuggestionsIndex({
							index: Math.max(currentIndex - 1, 0)
						})
					}
				},
				neighbors: { up: "input", right: "applied" }
			},
			{
				name: "applied",
				arrows: ["left", "right"],
				callbacks: {
					abort: () => setCloseModalOpen(true),
					"quickEdit.removeTag": () => {
						const currentTags = tagsActiveRef.current
						const currentIndex = state.get().context.indexApplied
						const newTags = currentTags.filter(
							(_, index) => index !== currentIndex
						)
						state.trigger.setActiveTags({ tags: [...newTags] })
					},
					"quickEdit.nextApplied": () => {
						const maxIndex = tagsActiveRef.current.length - 1
						const currentIndex = state.get().context.indexApplied
						state.trigger.setAppliedIndex({
							index: Math.min(currentIndex + 1, maxIndex)
						})
					},
					"quickEdit.previousApplied": () => {
						const currentIndex = state.get().context.indexApplied
						state.trigger.setAppliedIndex({
							index: Math.max(currentIndex - 1, 0)
						})
					}
				},
				neighbors: { left: "suggestions", up: "tagType" }
			}
		],
		initialZone: "input"
	})

	return (
		<>
			<box height={"100%"} width={"100%"}>
				<QuickEditHeader
					track={track}
					onClose={() => setCloseModalOpen(true)}
				/>

				<box flexDirection="row" height={"100%"} width={"100%"}>
					<box maxWidth={"50%"} flexShrink={1}>
						<TagTabs focused={isActive("tagType")} activeType={tagType} />

						<TagsInput
							input={input}
							onChange={(value) => state.trigger.setInput({ input: value })}
							onSubmit={(submitInput) =>
								state.trigger.addTagFromInput({ input: submitInput })
							}
							focused={isActive("input")}
							title={`┤2├ Search for ${tagType} `}
							placeholder={`Search ${tagType}..`}
						/>

						<Suggestions
							index={indexSuggestion}
							focused={isActive("suggestions")}
							suggestions={suggestions}
							onIndexChange={(newIndex) =>
								state.trigger.setSuggestionsIndex({ index: newIndex })
							}
							onSelect={(selectedIdx) => {
								const suggestion = suggestions[selectedIdx]
								if (suggestion) {
									state.trigger.setActiveTags({
										tags: [...tagsActiveRef.current, suggestion]
									})
								}
							}}
						/>
					</box>

					<AppliedSuggestions
						title={`┤4├ Applied ${tagType} `}
						items={tagsActive}
						focused={isActive("applied")}
						focusIndex={indexApplied}
					/>
				</box>

				<Playbar />
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
							const { tagsApplied } = state.get().context
							await musicLibrary.updateTags({
								id: track.id,
								genre: tagsApplied.genre,
								mood: tagsApplied.mood
							})
							appState.trigger.goBackOrHome()
						} catch (error) {
							notifications.addError("Failed to update file tags", error)
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
	placeholder,
	title
}: {
	input: string
	focused: boolean
	onChange: (input: string) => void
	onSubmit: (input: string) => void
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
				onInput={onChange}
				placeholder={placeholder}
				width={"100%"}
				onSubmit={onSubmit as InputProps["onSubmit"]}
			/>
		</box>
	)
}

const tagTypesList: { type: TagType; label: string }[] = [
	{ type: "mood", label: "Mood" },
	{ type: "genre", label: "Genre" }
]

function TagTabs({
	focused,
	activeType
}: {
	activeType: TagType
	focused: boolean
}) {
	const colors = useColors()

	return (
		<box
			title="┤1├ Tag "
			border
			borderStyle="rounded"
			borderColor={focused ? colors.blue : colors.brightBlack}
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
	focused: hasFocus,
	index,
	onIndexChange,
	onSelect
}: {
	index: number
	focused: boolean
	suggestions: string[]
	onIndexChange: (index: number) => void
	onSelect: (index: number) => void
}) {
	const colors = useColors()

	return (
		<box
			title="┤3├ Suggestions "
			width={"100%"}
			flexGrow={1}
			flexShrink={100}
			border
			borderStyle="rounded"
			overflow="hidden"
			borderColor={hasFocus ? colors.blue : colors.brightBlack}
		>
			{suggestions.length > 0 ? (
				<Select
					options={suggestions.map((suggestion) => ({
						name: suggestion,
						description: suggestion
					}))}
					selectedIndex={index}
					onChange={onIndexChange}
					onSelect={onSelect}
					focused={hasFocus}
					showDescription={false}
					height={"100%"}
					selectedTextColor={colors.yellow}
					textColor={colors.brightBlack}
					backgroundColor={colors.bg}
					focusedTextColor={colors.brightBlack}
					focusedBackgroundColor={colors.bg}
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
	title,
	focusIndex
}: {
	focused: boolean
	items: readonly string[]
	title: string
	focusIndex: number
}): ReactNode {
	const colors = useColors()

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
					const isFocused = index === focusIndex

					return (
						<box key={item} width={"auto"} flexDirection="row" gap={1}>
							<text
								fg={hasFocus && isFocused ? colors.blue : colors.fg}
								width={"auto"}
							>
								<b attributes={TextAttributes.DIM}>(</b>
								{item}
								<b attributes={TextAttributes.DIM}>)</b>
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
			await onExit()
		}

		if (key.name === "x") {
			await onExitNoSave()
		}
	})

	const colors = useColors()

	return (
		<box>
			<text fg={colors.fg} attributes={TextAttributes.BOLD} marginBottom={1}>
				Go back?
			</text>
			<text fg={colors.blue}>Save and go [Enter]</text>
			<text fg={colors.yellow}>Go without saving [X]</text>
			<text fg={colors.fg}>Cancel [ESC]</text>
		</box>
	)
}

function QuickEditHeader({
	track,
	onClose
}: {
	track: BaseTrack
	onClose: () => void
}): ReactNode {
	const colors = useColors()
	const icons = useIcons()
	const title = track.title ?? path.basename(track.id)
	const currentTrack = useCurrentTrack()
	const playstate = usePlayState()

	const isCurrent = currentTrack?.id === track.id
	const showWarning = !isCurrent && playstate !== "stopped"

	return (
		<box
			flexDirection="row"
			width={"100%"}
			justifyContent="space-between"
			border={["bottom"]}
			borderColor={colors.yellow}
		>
			<text fg={colors.yellow} height={1}>
				{icons.edit}
				{"  "}
				{title}
				{" - "}
				{track.artist ?? track.albumartist ?? "(unknown artist)"}

				{showWarning && <span fg={colors.red}> | Not playing currently</span>}
			</text>

			<text
				onMouseDown={onClose}
				fg={colors.fg}
				attributes={TextAttributes.DIM}
			>
				[ESC] Go back
			</text>
		</box>
	)
}
