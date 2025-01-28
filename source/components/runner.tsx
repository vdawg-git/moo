import { Box, List, Text, useKeymap, useList, useListItem } from "tuir"
import { appCommands } from "#/commands/commands"
import { appState } from "#/state/state"

const runnerId = "_runner"

export function openRunner() {
	const items: RunnerItem[] = appCommands
		.filter((command) => command.id !== "runner.open")
		.map(({ label, callback, id }) => ({
			id,
			label,
			onSelect: callback
		}))

	appState.send({
		type: "addModal",
		modal: { Content: () => Runner({ items }), id: runnerId, title: "Commands" }
	})
}

export type RunnerItem = {
	/** This gets displayed */
	label: string
	/** Must be unique */
	id: string
	onSelect: (item: RunnerItem) => void
}

type RunnerProps = {
	items: readonly RunnerItem[]
}

function Runner({ items: runnerItems }: RunnerProps) {
	const { listView, items } = useList(runnerItems, {
		windowSize: "fit",
		unitSize: 1,
		navigation: "vi-vertical",
		centerScroll: false,
		fallthrough: false
	})

	return (
		<Box>
			<List listView={listView}>
				{items.map((item, index) => (
					<RunnerItem key={item.id} />
				))}
			</List>
		</Box>
	)
}

function RunnerItem(): React.ReactNode {
	const { isFocus, item } = useListItem<RunnerItem[]>()
	const { label, onSelect } = item
	const color = isFocus ? "blue" : undefined

	const { useEvent } = useKeymap({ submit: { key: "return" } })
	useEvent("submit", () => onSelect(item))

	return (
		<Box
			width="100"
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
