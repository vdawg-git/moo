import { Box, Text } from "tuir"
import { manageKeybinds, type SequencePart } from "#/KeybindManager"
import { displayKeybinding } from "#/config/shortcutParser"

type NextUpKeybind = { label: string; toPress: string; id: string }

/**
 * Shows which keybinds can be pressed next.
 */
export function NextUpKeybinds() {
	const sequencePartMaybe = manageKeybinds()

	const toDisplay = sequencePartMaybe && sequencePartToNextUp(sequencePartMaybe)

	return (
		toDisplay && (
			<Box
				marginX={1}
				key={2}
				borderStyle={"single"}
				borderColor={"yellow"}
				backgroundColor={"black"}
				position="absolute"
				justifyContent="space-between"
				minWidth={20}
			>
				<Box flexDirection="column">
					{toDisplay.map(({ toPress, id }) => (
						<Box key={id}>
							<Text color={"cyan"}>{toPress} </Text>
						</Box>
					))}
				</Box>

				<Box flexDirection="column">
					{toDisplay.map(({ label, id }) => (
						<Box key={id}>
							<Text>{label} </Text>
						</Box>
					))}
				</Box>
			</Box>
		)
	)
}

function sequencePartToNextUp({
	nextPossible,
	pressed: { length: pressedAmount }
}: SequencePart): readonly NextUpKeybind[] {
	return nextPossible.map(({ id, label, keybinding }) => ({
		id,
		label,
		toPress: displayKeybinding(keybinding.slice(pressedAmount))
	}))
}
