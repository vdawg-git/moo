import { useMemo } from "react"
import { appConfig } from "#/config/config"
import { useColors } from "#/hooks/useColors"
import { displayKeybinding } from "#/lib/keybinds"
import type { ReactNode } from "react"

export function KeybindsModal(): ReactNode {
	const toDisplay = useMemo(getKeybinds, [])
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
							<text fg={colors.fg} key={binding.join("")}>
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
function getKeybinds() {
	return appConfig.keybindings.entries().toArray()
}
