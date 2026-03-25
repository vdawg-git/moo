import { useEffect, useRef, useState } from "react"
import { useAppContext } from "#/app/context"
import { useConfig } from "#/shared/config/configContext"
import { useColors } from "#/ui/hooks/useColors"
import { useFocusZones } from "#/ui/hooks/useFocusZone"
import { Input } from "../Input"
import { Select } from "../select"
import { useRunnerItems } from "./useRunnerItems"
import type { InputRenderable, KeyEvent, RGBA } from "@opentui/core"
import type { InputProps } from "@opentui/react"
import type { AppStore } from "#/core/state/state"
import type { AppModalContentProps } from "#/core/state/types"
import type { AppConfig } from "#/shared/config/config"
import type { AppColor, AppColorName } from "#/shared/config/theme"
import type { RefObject } from "react"
import type React from "react"

const runnerId = "_runner"

export function openRunner(appState: AppStore, initialSearch?: string) {
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
	const { keybindManager } = useAppContext()
	const { items, setInput, mode, input } = useRunnerItems({ initialValue })
	const [selectedIndex, setSelectedIndex] = useState(0)
	const activeItem = items[selectedIndex]
	const inputRef = useRef<InputRenderable>(null)

	// refactor-later useRef needed because callbacks captured in trie go stale; system could lazily resolve
	const itemsRef = useRef(items)
	itemsRef.current = items
	const inputValueRef = useRef(input)
	inputValueRef.current = input
	const selectedIndexRef = useRef(selectedIndex)
	selectedIndexRef.current = selectedIndex
	const setZoneRef = useRef<(name: "input" | "list") => void>(() => {})

	const onSubmit = () => {
		if (!activeItem) return
		modal.closeModal()
		activeItem.onSelect()
	}

	const { isActive, setZone } = useFocusZones({
		zones: [
			{
				name: "input",
				isInput: true,
				callbacks: {
					accept: onSubmit
				},
				neighbors: { down: "list" }
			},
			{
				name: "list",
				arrows: ["up", "down"],
				callbacks: {
					"runner.nextItem": () => {
						setSelectedIndex((previous) =>
							Math.min(previous + 1, itemsRef.current.length - 1)
						)
					},
					"runner.previousItem": () => {
						if (selectedIndexRef.current === 0) {
							setZone("input")
							return
						}
						setSelectedIndex((previous) => Math.max(previous - 1, 0))
					},
					accept: onSubmit
				},
				neighbors: { up: "input" }
			}
		],
		initialZone: "input",
		onUnmatchedKey: (key) => {
			if (key.key.length !== 1 || key.modifiers.length > 0) return

			const newInput = (inputValueRef.current ?? "") + key.key
			setZoneRef.current("input")
			setInput(newInput)

			// The input gets set in the new render.
			// But the cursor position gets set outside of the React lifecycle, so we delay a bit
			setTimeout(() => {
				if (inputRef.current) {
					inputRef.current.cursorOffset = newInput.length
				}
			}, 5)
		}
	})
	setZoneRef.current = setZone

	useEffect(() => {
		if (!mode) {
			modal.changeTitle("Go to..")
			modal.changeColor("blue")
			return
		}
		modal.changeTitle(mode.icon + " " + mode.type)
		modal.changeColor(mode.color)

		if (mode.type === "commands") {
			return keybindManager.disableCommand("runner.openCommands")
		}
	}, [mode, modal, keybindManager])

	return (
		<box flexDirection="column" minWidth={"50%"} width={"50%"} maxWidth={50}>
			<RunnerInput
				value={input}
				focused={isActive("input")}
				onInput={setInput}
				onSubmit={onSubmit}
				onGetFocus={() => setZone("input")}
				ref={inputRef}
				color={mode?.color ?? "blue"}
			/>

			<RunnerList
				focused={isActive("list")}
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
				onSubmit={onSubmit as InputProps["onSubmit"]}
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

function getRunnerListItemIconByType(
	icons: AppConfig["icons"]
): Record<RunnerItem["type"], string> {
	return {
		"go-to": icons.arrow,
		album: icons.album,
		artist: icons.artist,
		command: icons.command,
		playlist: icons.playlist
	}
}

// oxlint-disable eslint(no-unused-vars)
function RunnerListItem({
	item,
	focused,
	listFocused
}: RunnerItemProps): React.ReactNode {
	const config = useConfig()
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
	const icon = item.icon ?? getRunnerListItemIconByType(config.icons)[item.type]

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
