import { useKeyboard } from "@opentui/react"
import { type RefObject, useEffect, useRef, useState } from "react"
import { pickCommands } from "#/commands/commandFunctions"
import { appConfig } from "#/config/config"
import { useColors } from "#/hooks/useColors"
import {
	registerKeybinds,
	unregisterKeybinds
} from "#/keybindManager/keybindManager"
import { appState } from "#/state/state"
import { Input } from "../Input"
import { Select } from "../select"
import { useRunnerItems } from "./useRunnerItems"
import type { InputRenderable, KeyEvent, RGBA } from "@opentui/core"
import type React from "react"
import type { AppColor, AppColorName } from "#/config/theme"
import type { AppModalContentProps } from "#/state/types"

const runnerId = "_runner"

export function openRunner(initialSearch?: string) {
	const id = runnerId + (initialSearch ?? "")

	appState.send({
		type: "addModal",
		modal: {
			Content: (modal) => Runner({ modal, initialValue: initialSearch }),
			id,
			title: "Commands"
		}
	})
}

export type RunnerItem = {
	/** This gets displayed */
	label: string
	/**
	 * Optional icon. If not set the default icon for the type will get rendered.
	 * Usually used for `go-to` types to make them less generic.
	 */
	icon?: string
	type: "album" | "playlist" | "command" | "artist" | "go-to"
	/** Must be unique */
	id: string
	onSelect: () => void
}

type RunnerProps = {
	/**
	 * `>` to show commands
	 */
	initialValue?: string
	modal: AppModalContentProps
}

function Runner({ modal, initialValue }: RunnerProps) {
	const { items, setInput, mode, input } = useRunnerItems({ initialValue })
	const [selectedIndex, setSelectedIndex] = useState(0)
	const [focused, setFocused] = useState<"input" | "list">("input")
	const activeItem = items[selectedIndex]
	const inputRef = useRef<InputRenderable>(null)

	const onSubmit = () => {
		if (!activeItem) return
		modal.onCloseModal()
		activeItem.onSelect()
	}

	const onInput = (newText: string) => {
		setInput(newText)
	}

	useKeyboard((event) => {
		const name = event.name
		if (name === "tab") {
			setFocused((previous) => (previous === "input" ? "list" : "input"))
			return
		}
		if (name === "down") {
			setFocused("list")
			return
		}

		if (focused === "list" && name === "up" && selectedIndex === 0) {
			setFocused("input")
			setSelectedIndex(0)
			return
		}

		if (focused === "input" && name === "up") {
			setFocused("list")
			setSelectedIndex(items.length - 1)
			return
		}
		if (name === "return") {
			onSubmit()
			return
		}

		if (focused === "list" && event.name.length === 1) {
			const newInput = (input ?? "") + event.name
			setInput(newInput)
			if (inputRef.current) {
				inputRef.current.cursorPosition === 999
			}
			setFocused("input")

			return
		}
	})

	useEffect(() => {
		if (!mode) {
			modal.onChangeTitle("Go to..")
			modal.onChangeColor("blue")
			return
		}
		modal.onChangeTitle(mode.icon + " " + mode.type)
		modal.onChangeColor(mode.color)

		// TODO the command still shows, even though it is removed from the keybindingsState
		// but maybe there is another registration with different keybindings in my config
		// Need to check later
		const toUnregister =
			mode.type === "commands" && pickCommands(["runner.openCommands"])

		if (toUnregister) {
			unregisterKeybinds(toUnregister)
		}

		return () => {
			if (toUnregister) {
				registerKeybinds(toUnregister, { when: "default" })
			}
		}
	}, [mode, modal.onChangeTitle, modal.onChangeColor])

	return (
		<box flexDirection="column" minWidth={"50%"} width={"50%"} maxWidth={50}>
			<RunnerInput
				value={input}
				focused={focused === "input"}
				onInput={onInput}
				onSubmit={onSubmit}
				onGetFocus={() => setFocused("input")}
				ref={inputRef}
				color={mode?.color ?? "blue"}
			/>

			<RunnerList
				focused={focused === "list"}
				items={items}
				selectedIndex={selectedIndex}
				onIndexChange={setSelectedIndex}
				onSelect={onSubmit}
			/>
		</box>
	)
}

type RunnerInputProps = {
	value: string | undefined
	onInput: (newValue: string) => void
	onKeyDown?: (key: KeyEvent) => void
	onSubmit: (value: string) => void
	onGetFocus: () => void
	/** Only visual focus. We use the input to drive the input value so it is always focused,
	 * but just not visually */
	focused: boolean
	ref: RefObject<InputRenderable | null>
	color: AppColorName
}

function RunnerInput({
	focused,
	value,
	onInput,
	onSubmit,
	onGetFocus,
	ref,
	color: colorName
}: RunnerInputProps): React.ReactNode {
	const colors = useColors()
	const color = colors[colorName]

	return (
		<box
			border={["bottom"]}
			borderColor={focused ? color : colors.brightBlack}
			paddingLeft={1}
			paddingRight={1}
			height={2}
			width={"100%"}
			minWidth={"100%"}
			onMouseDown={onGetFocus}
		>
			<Input
				ref={ref}
				focused={focused}
				value={value}
				placeholder="Search.."
				onInput={onInput}
				focusedTextColor={colors.blue}
				textColor={colors.brightBlack}
				placeholderColor={colors.black}
				focusedBackgroundColor={colors.bg}
				onSubmit={onSubmit}
				cursorStyle={{
					blinking: focused,
					style: focused ? "line" : "underline"
				}}
			/>
		</box>
	)
}

type RunnerListProps = {
	items: readonly RunnerItem[]
	selectedIndex: number
	focused: boolean
	onIndexChange: (index: number) => void
	onSelect: (index: number) => void
}

export function RunnerList({
	items,
	onSelect,
	selectedIndex,
	onIndexChange,
	focused
}: RunnerListProps) {
	// const list = useList({
	// 	name: "runner",
	// 	index: selectedIndex,
	// 	items,
	// 	onSelect: ({ index }) => onSelect(index),
	// 	onFocusItem: ({ index }) => onIndexChange(index),
	// 	focused
	// })
	const colors = useColors()

	return (
		<box minHeight={15} height={15} maxHeight={15}>
			<Select
				options={items.map((item) => ({
					name: item.label,
					description: item.label
				}))}
				onChange={(index) => onIndexChange(index)}
				selectedIndex={selectedIndex}
				onSelect={(index) => onSelect(index)}
				height={15}
				showDescription={false}
				focused={focused}
				backgroundColor={colors.bg}
				textColor={colors.fg}
				focusedTextColor={colors.fg}
				focusedBackgroundColor={colors.bg}
				selectedTextColor={focused ? colors.bg : colors.blue}
				selectedBackgroundColor={focused ? colors.blue : colors.bg}
			/>
		</box>
	)
}

type RunnerItemProps = {
	item: RunnerItem
	focused: boolean
	listFocused: boolean
}

// const itemIconColor: Record<RunnerItem['type'], RGBA>

const runnerListItemIconByType: Record<RunnerItem["type"], string> = {
	"go-to": appConfig.icons.arrow,
	album: appConfig.icons.album,
	artist: appConfig.icons.artist,
	command: appConfig.icons.command,
	playlist: appConfig.icons.playlist
}

// biome-ignore lint/correctness/noUnusedVariables: We will use this again later as the select input is not very styleable.
function RunnerListItem({
	item,
	focused,
	listFocused
}: RunnerItemProps): React.ReactNode {
	const colors = useColors()

	const backgroundColor: AppColor | undefined = focused
		? listFocused
			? colors.blue
			: colors.black
		: undefined
	const color: AppColor = focused ? colors.bg : colors.fg

	const { label } = item

	const iconColors: Record<RunnerItem["type"], RGBA> = {
		"go-to": colors.fg,
		album: colors.albums,
		artist: colors.artists,
		command: colors.fg,
		playlist: colors.playlists
	}

	const iconColor = iconColors[item.type]
	const icon = item.icon ?? runnerListItemIconByType[item.type]

	return (
		<box minWidth={40} flexDirection="row">
			<box marginRight={1} width={1}>
				<text fg={iconColor}>{icon ?? ""}</text>
			</box>
			<text bg={backgroundColor} fg={color}>
				{label}
			</text>
		</box>
	)
}
