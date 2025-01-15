import { Box, Text, useInput } from "ink"
import React, { useReducer, useState } from "react"

// Currently only used to switch playlists,

type RunnerProps = {
	items: readonly RunnerItem[]
}

type RunnerItem = {
	/** This gets displayed */
	label: string
	/** Must be unique */
	id: string
	onSelect: (item: RunnerItem) => void
}

export function Runner(props: RunnerProps) {
	const items = props.items
	const [activeIndex, dispatchIndexChange] = useReducer(
		handleUpDown(0, items.length - 1),
		0
	)

	useInput((input, key) => {
		if (input === "down") {
			dispatchIndexChange(-1)
		}
		if (input === "up") {
			dispatchIndexChange(1)
		}
	})

	return (
		<Box>
			{items.map((item, index) => (
				<Box key={item.id}>
					<Text color={"white"} dimColor={index !== activeIndex}>
						{item.label}
					</Text>
				</Box>
			))}
		</Box>
	)
}

function handleUpDown(minIndex: number, maxIndex: number) {
	return (previousIndex: number, change: -1 | 1): number => {
		const newValue = previousIndex + change

		if (newValue < minIndex) return maxIndex
		if (newValue > maxIndex) return minIndex

		return newValue
	}
}
