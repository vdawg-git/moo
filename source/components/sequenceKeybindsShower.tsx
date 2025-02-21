import { Box, Modal, Text } from "tuir"
import type { AppCommand } from "#/commands/commands"
import { displayKeybinding } from "#/config/shortcutParser"

type SequenceKeybinsProps = {
	commandsToShow: readonly AppCommand[] | undefined
}

/**
 * Shows which keybinds can be pressed next.
 */
export function NextUpKeybinds({ commandsToShow }: SequenceKeybinsProps) {
	return commandsToShow?.map(({ keybinding, label }) => {
		const keybindingDisplay = displayKeybinding(keybinding)

		return (
			<Box borderStyle={"round"} key={keybindingDisplay}>
				<Text>{keybindingDisplay}</Text>
				<Text>{label}</Text>
			</Box>
		)
	})
}
