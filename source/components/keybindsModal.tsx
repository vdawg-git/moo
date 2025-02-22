import { appConfig } from "#/config/config"
import { displayKeybinding } from "#/config/shortcutParser"
import type React from "react"
import { useMemo } from "react"
import { Box, Text } from "tuir"

type KeybindDisplay = {
	id: string
	label: string
	/** A keybinding can have multiple bindings */
	bindings: string[]
}

/** A function as this is a cyclical import */
function getKeybinds(): readonly KeybindDisplay[] {
	const keybinds = appConfig.keybindings

	return Object.values(
		keybinds.reduce(
			(accumulator, { id, label, keybinding }) => {
				const binding = displayKeybinding(keybinding)

				if (accumulator[id]) {
					accumulator[id].bindings.push(binding)
				} else {
					accumulator[id] = { id, label, bindings: [binding] }
				}

				return accumulator
			},
			{} as Record<string, KeybindDisplay>
		)
	)
}

export function KeybindsModal(): JSX.Element {
	const toDisplay = useMemo(getKeybinds, [])

	return (
		<Box flexDirection="column" minWidth={30}>
			{toDisplay.map(({ label, bindings, id }) => (
				<Box key={id} alignItems="flex-start" justifyContent="space-between">
					<Text color={"cyanBright"}>{label}</Text>

					<Box flexDirection="column">
						{bindings.map((binding, index) => (
							<Text key={binding}>{binding}</Text>
						))}
					</Box>
				</Box>
			))}
		</Box>
	)
}
