import { useCallback, useEffect, useState } from "react"
import { pickCommands } from "#/commands/commandFunctions"
import { useColors } from "#/hooks/useColors"
import {
	registerKeybinds,
	unregisterKeybinds
} from "#/keybindManager/keybindManager"
import { appState } from "#/state/state"
import { useRunnerItems } from "./useRunnerItems"
import type { KeyEvent } from "@opentui/core"
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
	/** Gets shown before the label */
	icon?: string
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

	const onClose = useCallback(() => {
		modal.onCloseModal()
	}, [modal.onCloseModal])

	const onSubmit = () => {
		if (!activeItem) return
		activeItem.onSelect()
		onClose()
	}

	useEffect(() => {
		input
		setSelectedIndex(0)
		setFocused("input")
	}, [input])

	const onInput = (newText: string) => {
		const key = newText.at(-1)

		// We want to allow for vim bindings list navigation if it is focused
		if (focused === "list" && (key === "j" || key === "k")) return

		setInput(newText)
	}

	const onKeyDown = (key: KeyEvent) => {
		const name = key.name
		if (name === "tab") {
			setFocused((previous) => (previous === "input" ? "list" : "input"))
			return
		}
		if (name === "down") {
			setFocused("list")
			setSelectedIndex((previous) =>
				previous >= items.length - 1 ? 0 : previous + 1
			)
			return
		}
		if (name === "up") {
			setFocused("list")
			setSelectedIndex((previous) =>
				previous <= 0 ? items.length - 1 : previous - 1
			)
			return
		}
		if (name === "return") {
			onSubmit()
			return
		}
	}

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
				registerKeybinds(toUnregister)
			}
		}
	}, [mode, modal.onChangeTitle])

	return (
		<box flexDirection="column" minWidth={"50%"} width={"50%"} maxWidth={50}>
			<RunnerInput
				value={input}
				focused={focused === "input"}
				onInput={onInput}
				onKeyDown={onKeyDown}
				onSubmit={onSubmit}
			/>

			<RunnerList
				focused={focused === "list"}
				items={items}
				selectedIndex={selectedIndex}
			/>
		</box>
	)
}

type RunnerInputProps = {
	value: string | undefined
	onInput: (newValue: string) => void
	onKeyDown: (key: KeyEvent) => void
	onSubmit: (value: string) => void
	/** Only visual focus. We use the input to drive the input value so it is always focused,
	 * but just not visually */
	focused: boolean
}

function RunnerInput({
	focused,
	value,
	onInput,
	onKeyDown,
	onSubmit
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
		>
			<input
				focused
				value={value}
				placeholder="Search.."
				onInput={onInput}
				onKeyDown={onKeyDown}
				textColor={focused ? colors.brightWhite : colors.white}
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
}

export function RunnerList({ items, selectedIndex }: RunnerListProps) {
	return (
		<box minHeight={16}>
			{items.map((item, index) => (
				<RunnerListItem
					item={item}
					focused={selectedIndex === index}
					key={item.id}
				/>
			))}
		</box>
	)
}

type RunnerItemProps = {
	item: RunnerItem
	focused: boolean
}

function RunnerListItem({ item, focused }: RunnerItemProps): React.ReactNode {
	const colors = useColors()

	const backgroundColor: AppColor | undefined = focused
		? colors.blue
		: undefined
	const color: AppColor = focused ? colors.bg : colors.fg

	const { label, icon } = item

	return (
		<box minWidth={40} flexDirection="row">
			<box marginRight={1} width={1}>
				<text fg={backgroundColor}>{icon ?? ""}</text>
			</box>
			<text bg={backgroundColor} fg={color}>
				{label}
			</text>
		</box>
	)
}
