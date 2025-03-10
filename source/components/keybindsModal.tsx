import { useMemo } from "react"
import { Box, Text } from "tuir"
import { appConfig } from "#/config/config"
import { displayKeybinding } from "#/config/shortcutParser"

export function KeybindsModal(): JSX.Element {
	const toDisplay = useMemo(getKeybinds, [])

	return (
		<Box flexDirection="column" minWidth={30}>
			{toDisplay.map(([id, { label, keybindings }]) => (
				<Box key={id} alignItems="flex-start" justifyContent="space-between">
					<Text color={"cyanBright"}>{label}</Text>

					<Box flexDirection="column">
						{keybindings.map((binding) => (
							<Text key={binding.join("")}>{displayKeybinding(binding)}</Text>
						))}
					</Box>
				</Box>
			))}
		</Box>
	)
}

/** A function as this is a cyclical import */
function getKeybinds() {
	return appConfig.keybindings.entries().toArray()
}
