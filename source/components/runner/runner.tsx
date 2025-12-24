import { useKeyboard } from "@opentui/react"
import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import { pickCommands } from "#/commands/commandFunctions"
import { appConfig } from "#/config/config"
import { useColors } from "#/hooks/useColors"
import {
	registerKeybinds,
	unregisterKeybinds
} from "#/keybindManager/keybindManager"
import { appState } from "#/state/state"
import { Input } from "../Input"
import { List, useList } from "../list"
import { useRunnerItems } from "./useRunnerItems"
import type { InputRenderable, KeyEvent, RGBA } from "@opentui/core"
import type React from "react"
import type { AppColor } from "#/config/theme"
import type { AppModalContentProps } from "#/state/types"

const runnerId = "_runner"

export function openRunner(initialSearch?: string) {
	appState.send({
		type: "addModal",
		modal: {
			Content: (modal) => Runner({ modal, initialValue: initialSearch }),
			id: runnerId,
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

	const onClose = useCallback(() => {
		modal.onCloseModal()
	}, [modal.onCloseModal])

	const onSubmit = () => {
		if (!activeItem) return
		activeItem.onSelect()
		onClose()
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

		if (name === "up" && selectedIndex === 0) {
			setFocused("input")
			setSelectedIndex(0)
			return
		}

		if (name === "up") {
			setFocused("list")
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
			return
		}
		modal.onChangeTitle(mode.icon + " " + mode.type)

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
	}, [mode, modal.onChangeTitle])

	return (
		<box flexDirection="column" minWidth={"50%"} width={"50%"} maxWidth={50}>
			<text>{selectedIndex}</text>
			<RunnerInput
				value={input}
				focused={focused === "input"}
				onInput={onInput}
				onSubmit={onSubmit}
				onGetFocus={() => setFocused("input")}
				ref={inputRef}
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
}

function RunnerInput({
	focused,
	value,
	onInput,
	onKeyDown,
	onSubmit,
	onGetFocus,
	ref
}: RunnerInputProps): React.ReactNode {
	const colors = useColors()

	return (
		<box
			border={["bottom"]}
			borderColor={focused ? colors.blue : colors.brightBlack}
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
				onKeyDown={onKeyDown}
				focusedTextColor={colors.blue}
				textColor={colors.brightBlack}
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
	const list = useList({
		name: "runner",
		index: selectedIndex,
		items,
		onSelect: ({ index }) => onSelect(index),
		onFocusItem: ({ index }) => onIndexChange(index),
		focused,
		searchKeys: [{ name: "label", getFunction: (item) => item.label }]
	})

	return (
		<box minHeight={16}>
			<List
				register={list}
				render={(item, { focused: itemFocused }) => (
					<RunnerListItem
						listFocused={focused}
						focused={itemFocused}
						item={item}
					/>
				)}
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
