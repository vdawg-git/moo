import type React from "react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import {
	Box,
	type Color,
	Key,
	type KeyInput,
	List,
	Node,
	Text,
	TextInput,
	useKeymap,
	useList,
	useListItem,
	useNode,
	useNodeMap,
	useTextInput
} from "tuir"
import { type AppModalContentProps, appState } from "#/state/state"
import { useRunnerItems } from "./useRunnerItems"
import { logg } from "#/logs"

/**
 * This component is a bit complicated,
 * as in order for "J/K" to work for the list navigation,
 * the list needs to be focused.
 *
 * So focus switching is required + plus all the other goodies from the VS Code runner.
 */
/** */

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
	const { items: runnerItems, setInput, mode } = useRunnerItems()
	const [activeItem, setActiveItem] = useState<RunnerItem | undefined>()
	const nodemap = useNodeMap([["textinput"], ["list"]], { navigation: "none" })
	const updateInputValueRef =
		useRef<(updater: (oldValue: string) => string) => void>()
	const setUpdateInputValueRef = useCallback(
		(toSet: (updater: (oldValue: string) => string) => void) => {
			updateInputValueRef.current = toSet
		},
		[]
	)
	const updateIndexRef =
		useRef<(updater: (oldIndex: number) => number) => void>()
	const onInputChange = useCallback(
		(input: string) => {
			setInput(input)
			updateIndexRef.current?.(() => 0)
		},
		[setInput]
	)

	const onClose = () => {
		modal.closeModal()
	}

	const onSelect = () => {
		onClose()
		activeItem?.onSelect()
	}

	useEffect(() => {
		mode && modal.changeTitle(mode)
	}, [mode, modal.changeTitle])

	return (
		<Box
			flexDirection="column"
			alignItems="flex-start"
			justifyContent="flex-start"
		>
			<Node.Box {...nodemap.register("textinput")}>
				<RunnerInput
					onSelect={onSelect}
					onClose={onClose}
					onChange={onInputChange}
					initialValue={initialValue}
					bindUpdateValue={setUpdateInputValueRef}
					onGoDown={() => {
						updateIndexRef.current?.((oldIndex) => oldIndex + 1)
						nodemap.control.down()
					}}
				/>
			</Node.Box>

			<Node.Box {...nodemap.register("list")}>
				<RunnerList
					onIndexChange={(index) => {
						setActiveItem(runnerItems[index])
					}}
					onSelect={onSelect}
					onOtherInput={(input, specialKey) => {
						updateInputValueRef.current?.((oldValue) => {
							logg.debug("xxx", {
								value: oldValue ?? "ooo",
								specialKey: specialKey ?? "yo"
							})

							return oldValue + input
						})

						if (input !== "") {
							nodemap.control.goToNode("textinput")
						}
					}}
					onDeletePressed={() => {
						updateInputValueRef.current?.((oldValue) => oldValue.slice(0, -1))
						nodemap.control.goToNode("textinput")
					}}
					bindUpdateIndex={(updateIndex) => {
						updateIndexRef.current = updateIndex
					}}
				>
					{runnerItems.map((item) => (
						<RunnerListItem item={item} key={item.id} />
					))}
				</RunnerList>
			</Node.Box>
		</Box>
	)
}

type RunnerInputProps = {
	onChange: (value: string) => void
	/** When the user pressed enter */
	onSelect: (value: string) => void
	initialValue?: string
	onClose: () => void
	/**
	 * When the user presses `down` while in the textinput
	 * Should focus the list and go one item down in it.
	 */
	onGoDown: () => void
	bindUpdateValue: (
		binder: (updater: (oldValue: string) => string) => void
	) => void
}

function RunnerInput({
	onChange,
	initialValue,
	onSelect,
	onClose,
	onGoDown,
	bindUpdateValue
}: RunnerInputProps): React.ReactNode {
	const { control, isFocus } = useNode()

	const {
		onChange: _onChangeInternal,
		value,
		setValue
	} = useTextInput(initialValue ?? "")

	const updateValue = useCallback(
		(updater: (oldValue: string) => string): void => {
			// setValue always has to take in a string and not a function, so the dependency on value has to be there
			setValue(updater(value))
		},
		[setValue, value]
	)

	useEffect(() => {
		onChange(value)
	}, [value, onChange])

	useEffect(() => {
		bindUpdateValue(updateValue)
	}, [bindUpdateValue, updateValue])

	return (
		<Box
			height={2}
			borderLeft={false}
			borderRight={false}
			borderStyle={"single"}
			borderDimColor={!isFocus}
			borderColor={isFocus ? "blue" : "gray"}
			borderTop={false}
		>
			<TextInput
				onChange={_onChangeInternal}
				textStyle={{ bold: isFocus }}
				cursorColor={"blue"}
				autoEnter
				exitKeymap={[
					{ key: "tab" },
					{ key: "esc" },
					{ key: "down" },
					{ key: "return" }
				]}
				onExit={(_, char) => {
					if (char === Key.tab) control.next()
					if (char === Key.down) onGoDown()
					if (char === Key.return) onSelect(value)
					if (char === Key.esc) onClose()
				}}
			/>
		</Box>
	)
}

type RunnerListProps = {
	children: ReactNode[]
	onSelect: () => void
	onIndexChange: (newIndex: number) => void
	/**
	 * When the user pressed a non-navigation key,
	 * used to then focus the text input and update it
	 */
	onOtherInput: (letters: string, key: PressedSpecialKeys) => void
	/**
	 * Similiar to onOtherInput,
	 * but just for when the user presses `backspace`
	 *
	 * Its a workaround for `useEvent` not emitting the special keys
	 */
	onDeletePressed: () => void
	bindUpdateIndex: (
		binder: (updater: (oldIndex: number) => number) => void
	) => void
}

export function RunnerList({
	children,
	onSelect,
	onOtherInput,
	bindUpdateIndex,
	onDeletePressed,
	onIndexChange
}: RunnerListProps) {
	const node = useNode()

	const { listView, control } = useList(children.length, {
		navigation: "none",
		windowSize: 16,
		unitSize: 1
	})

	const updateIndex = useCallback(
		(updater: (oldIndex: number) => number) =>
			control.goToIndex(updater(control.currentIndex)),
		[control.currentIndex, control.goToIndex]
	)

	const { useEvent } = useKeymap({
		down: [{ key: "down" }, { input: "j" }],
		up: [{ key: "up" }, { input: "k" }],
		next: [{ key: "tab" }],
		select: [{ key: "return" }],
		otherInput: [{ notInput: ["j", "k"], notKey: ["backspace"] }],
		delete: [{ key: "backspace" }]
	})

	useEvent("down", control.nextItem)
	useEvent("up", () => {
		if (control.currentIndex === 0) {
			node.control.up()
			return
		}
		control.prevItem()
	})
	useEvent("next", node.control.next)
	useEvent("select", onSelect)
	useEvent("delete", onDeletePressed)
	useEvent("otherInput", (input) => {
		if (input !== "") {
			onOtherInput(input, new Set())
		}
	})

	useEffect(() => {
		bindUpdateIndex(updateIndex)
	}, [bindUpdateIndex, updateIndex])

	useEffect(() => {
		onIndexChange(control.currentIndex)
	}, [onIndexChange, control.currentIndex])

	return (
		<Box height={16}>
			<List listView={listView}>{children}</List>
		</Box>
	)
}

type RunnerItemProps = {
	item: RunnerItem
}

function RunnerListItem({ item }: RunnerItemProps): React.ReactNode {
	const { isFocus, isShallowFocus } = useListItem<RunnerItem[]>()
	const backgroundColor: Color | undefined = isShallowFocus
		? "green"
		: isFocus
			? "blue"
			: undefined
	const color: Color | undefined = isShallowFocus || isFocus ? "black" : "white"

	const { label, icon } = item

	return (
		<Box minWidth={40}>
			<Box marginRight={1} width={1}>
				<Text color={backgroundColor} wrap="truncate-end">
					{icon ?? ""}
				</Text>
			</Box>
			<Text backgroundColor={backgroundColor} color={color} wrap="truncate-end">
				{label}
			</Text>
		</Box>
	)
}

/** Gets the pressed letters. Ignores special keys like return */
function keyInputUnionToText(
	inputs: KeyInput | KeyInput[]
): string | undefined {
	const string = recursion(inputs)
	return string === "" ? undefined : string

	function recursion(inputs: KeyInput | KeyInput[]): string {
		return Array.isArray(inputs)
			? inputs.map(keyInputUnionToText).join("")
			: (inputs.input ?? "")
	}
}

type SpecialKeys = keyof (typeof Key & { ctrl: undefined })
type PressedSpecialKeys = Set<SpecialKeys>
