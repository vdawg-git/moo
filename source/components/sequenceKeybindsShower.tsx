import { TextAttributes } from "@opentui/core"
import { useColors } from "#/hooks/useColors"
import { useGetNextKeySequence } from "#/keybindManager/keybindManager"
import type { SequencePart } from "#/keybindManager/keybindManager"

type NextUpKeybind = { label: string; toPress: string; id: string }

/**
 * Shows which keybinds can be pressed next.
 */
export function NextUpKeybinds() {
	const sequencePartMaybe = useGetNextKeySequence()

	const toDisplay = sequencePartMaybe && sequencePartToNextUp(sequencePartMaybe)
	const colors = useColors()

	return (
		toDisplay
		&& toDisplay.length > 0 && (
			<box
				position="absolute"
				justifyContent="flex-end"
				alignItems="flex-end"
				height="100%"
				width="100%"
				zIndex={999}
			>
				<box
					marginLeft={1}
					marginRight={1}
					backgroundColor={colors.bg}
					borderStyle={"rounded"}
					borderColor={colors.yellow}
					justifyContent="space-between"
					flexDirection="row"
				>
					<box flexDirection="column">
						{toDisplay.map(({ toPress, id }) => (
							<box key={id}>
								<text fg={colors.cyan} attributes={TextAttributes.BOLD}>
									{toPress}{" "}
								</text>
							</box>
						))}
					</box>

					<box flexDirection="column">
						{toDisplay.map(({ label, id }) => (
							<box key={id}>
								<text fg={colors.fg}>{label} </text>
							</box>
						))}
					</box>
				</box>
			</box>
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
