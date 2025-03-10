import { Box, Text } from "tuir"
import {
	type SequencePart,
	manageKeybinds
} from "#/keybindManager/KeybindManager"

type NextUpKeybind = { label: string; toPress: string; id: string }

/**
 * Shows which keybinds can be pressed next.
 */
export function NextUpKeybinds() {
	const sequencePartMaybe = manageKeybinds()

	const toDisplay = sequencePartMaybe && sequencePartToNextUp(sequencePartMaybe)

	return (
		toDisplay &&
		toDisplay.length > 0 && (
			<Box
				position="absolute"
				justifyContent="flex-end"
				alignItems="flex-end"
				height="100%"
				width="100%"
			>
				<Box
					marginX={1}
					key={2}
					borderStyle={"single"}
					borderColor={"yellow"}
					justifyContent="space-between"
					minWidth={26}
					backgroundColor={"black"}
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
			</Box>
		)
	)
}

function sequencePartToNextUp({
	nextUp: nextPossible,
	pressed: { length: pressedAmount }
}: SequencePart): readonly NextUpKeybind[] {
	return nextPossible.map(({ command: { id, label }, keys }) => ({
		id,
		label,
		toPress: keys.slice(pressedAmount)
	}))
}
