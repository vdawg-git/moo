import { useMemo } from "react"
import { useConfig } from "#/config/configContext"
import { useColors } from "#/hooks/useColors"
import { displayKeybinding } from "#/lib/keybinds"
import type { AppConfig } from "#/config/config"
import type { ReactNode } from "react"

export function KeybindsModal(): ReactNode {
	const config = useConfig()
	const toDisplay = useMemo(
		() => getKeybinds(config.keybindings),
		[config.keybindings]
	)
	const colors = useColors()

	return (
		<box flexDirection="column" minWidth={30} backgroundColor={colors.bg}>
			{toDisplay.map(([id, { label, keybindings }]) => (
				<box
					key={id}
					alignItems="flex-start"
					justifyContent="space-between"
					flexDirection="row"
				>
					<text fg={colors.brightCyan}>{label}</text>

					<box flexDirection="column">
						{keybindings.map((binding) => (
							<text fg={colors.fg} key={JSON.stringify(binding)}>
								{displayKeybinding(binding)}
							</text>
						))}
					</box>
				</box>
			))}
		</box>
	)
}

/** A function as this is a cyclical import */
function getKeybinds(keybindings: AppConfig["keybindings"]) {
	return keybindings.entries().toArray()
}
