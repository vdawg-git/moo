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
import { logg } from "#/logs"
import { type AppModalContentProps, appState } from "#/state/state"
import { useRunnerItems } from "./useRunnerItems"

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
	const goToIndexRef = useRef<(nextIdx: number, center?: boolean) => void>()
	const onInputChange = useCallback(
		(input: string) => {
			setInput(input)
			goToIndexRef.current?.(0)
		},
		[setInput]
	)

	const { useEvent } = useKeymap(
		{
			select: { key: "return" },
			next: { key: "tab" }
		},
		{ priority: "always" }
	)

	useEvent("select", () => {
		modal.closeModal()
		logg.debug("selected", activeItem)
		activeItem?.onSelect()
	})

	useEffect(() => {
		mode && modal.changeTitle(mode)
	}, [mode, modal.changeTitle])

	const execActiveItem = () => {
		modal.closeModal()
		activeItem?.onSelect()
	}

	return (
		<Box
			flexDirection="column"
			alignItems="flex-start"
			justifyContent="flex-start"
		>
			<Node.Box {...nodemap.register("textinput")}>
				<RunnerInput
					onSelect={execActiveItem}
					onChange={onInputChange}
					initialValue={initialValue}
					bindUpdateValue={setUpdateInputValueRef}
				/>
			</Node.Box>

			<Node.Box {...nodemap.register("list")}>
				<RunnerList
					onSelect={execActiveItem}
					onOtherInput={(input) => {
						updateInputValueRef.current?.((value) => {
							logg.debug("withinUpdater", { value, input })
							return value + input
						})
						nodemap.control.goToNode("textinput")
					}}
					bindGoToIndex={(goTo) => {
						goToIndexRef.current = goTo
					}}
				>
					{runnerItems.map((item) => (
						<RunnerListItem item={item} onFocus={setActiveItem} key={item.id} />
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
	bindUpdateValue: (
		setter: (updater: (oldValue: string) => string) => void
	) => void
}

function RunnerInput({
	onChange,
	initialValue,
	onSelect,
	bindUpdateValue
}: RunnerInputProps): React.ReactNode {
	const { control, isFocus } = useNode()

	const {
		onChange: onChange_,
		value,
		// setValue does not take in a function to update
		// but always a string
		setValue
	} = useTextInput(initialValue ?? "")

	const updateValue = useCallback(
		(updater: (oldValue: string) => string): void => {
			const newValue = updater(value)
			logg.debug("called updater", {
				newValue,
				oldValue: value
			})
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
		logg.debug("bind updateValue function")
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
				onChange={onChange_}
				textStyle={{ inverse: true }}
				cursorColor={"blue"}
				autoEnter
				exitKeymap={[{ key: "tab" }, { key: "down" }, { key: "return" }]}
				onExit={(_, char) => {
					if (char === Key.tab) control.next()
					if (char === Key.down) control.down()
					if (char === Key.return) onSelect(value)
				}}
			/>
		</Box>
	)
}

type RunnerListProps = {
	children: ReactNode[]
	onSelect: () => void
	/**
	 * When the user pressed a non-navigation key,
	 * used to then focus the text input and update it
	 */
	onOtherInput: (letters: string) => void
	// TODO on input text change the first item should
	// be focused again
	bindGoToIndex: (setter: (nextIdx: number, center?: boolean) => void) => void
}

export function RunnerList({
	children,
	onSelect,
	onOtherInput,
	bindGoToIndex
}: RunnerListProps) {
	const node = useNode()

	const { listView, control } = useList(children.length, {
		navigation: "none",
		windowSize: 16,
		unitSize: 1
	})

	const { useEvent } = useKeymap({
		down: [{ key: "down" }, { input: "j" }],
		up: [{ key: "up" }, { input: "k" }],
		next: [{ key: "tab" }],
		select: [{ key: "return" }],
		otherInput: [{ notInput: ["j", "k"] }]
	})

	useEvent("down", control.nextItem)
	useEvent("up", control.prevItem)
	useEvent("next", node.control.next)
	useEvent("select", onSelect)
	useEvent("otherInput", (input) => {
		input && onOtherInput(input)
	})

	useEffect(() => {
		bindGoToIndex(control.goToIndex)
	}, [bindGoToIndex, control.goToIndex])

	return (
		<Box height={16}>
			<List listView={listView}>{children}</List>
		</Box>
	)
}

type RunnerItemProps = {
	onFocus: (item: RunnerItem) => void
	item: RunnerItem
}

function RunnerListItem({ onFocus, item }: RunnerItemProps): React.ReactNode {
	const {
		isFocus,
		isShallowFocus,
		onFocus: gotFocus
	} = useListItem<RunnerItem[]>()
	const color: Color | undefined = isShallowFocus
		? "green"
		: isFocus
			? "blue"
			: undefined

	const { label, icon } = item

	gotFocus(() => onFocus(item))

	return (
		<Box minWidth={40}>
			<Box marginRight={1} width={1}>
				<Text color={color} wrap="truncate-end">
					{icon ?? ""}
				</Text>
			</Box>
			<Text backgroundColor={color} wrap="truncate-end">
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
