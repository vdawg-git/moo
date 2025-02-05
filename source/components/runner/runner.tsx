import {
	Box,
	List,
	Text,
	TextInput,
	useKeymap,
	useList,
	useListItem,
	useTextInput,
	type Color
} from "tuir"
import { appCommands } from "#/commands/commands"
import { appState, type AppModalContentProps } from "#/state/state"
import { useContext, useEffect, useState } from "react"
import { useRunnerItems } from "./useRunnerItems"
import { logg } from "#/logs"

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
	onSelect: (item: RunnerItem) => void
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

	const {
		listView,
		items: listItems,
		setItems
	} = useList<readonly RunnerItem[]>([], {
		navigation: "vi-vertical",
		windowSize: 16
	})

	const { onChange, value, enterInsert } = useTextInput(initialValue ?? "")

	useEffect(() => {
		mode && modal.changeTitle(mode)
	}, [mode, modal.changeTitle])

	useEffect(() => {
		setInput(value)
	}, [setInput, value])

	useEffect(() => {
		setItems(runnerItems as RunnerItem[])
	}, [runnerItems, setItems])

	return (
		<Box
			flexDirection="column"
			alignItems="flex-start"
			justifyContent="flex-start"
		>
			<Box height={1}>
				<TextInput
					onChange={onChange}
					textStyle={{ inverse: true }}
					cursorColor={"blue"}
					autoEnter
					exitKeymap={[{ key: "tab" }, { key: "return" }, { key: "down" }]}
				/>
			</Box>

			<Box height={16}>
				<List listView={listView}>
					{listItems.map((item) => (
						<RunnerListItem key={item.id} />
					))}
				</List>
			</Box>
		</Box>
	)
}

function RunnerListItem(): React.ReactNode {
	const { isFocus, item, isShallowFocus } = useListItem<RunnerItem[]>()
	const { label, onSelect } = item
	const color: Color | undefined = isFocus
		? "blue"
		: isShallowFocus
			? "green"
			: undefined

	const { useEvent } = useKeymap({ submit: { key: "return" } })
	useEvent("submit", () => onSelect(item))

	return (
		<Box
			minWidth={40}
			backgroundColor={color}
			onClick={() => {
				onSelect(item)
				appState.send({ type: "closeModal", id: runnerId })
			}}
		>
			<Text wrap="truncate-end">{label}</Text>
		</Box>
	)
}
