import { appConfig } from "#/config/config"
import { registerKeybinds } from "#/keybindManager/KeybindManager"
import type { AppCommand } from "./appCommands"
import type { AppCommandID, appCommandsBase } from "./commandsBase"
import { getCommandCallback } from "./commandsCallbacks"

/**
 * Registers the keybinds for the global commands
 */
export function registerGlobalCommands() {
	const toRegister = pickCommands([
		"showKeybinds",
		"runner.openCommands",
		"runner.openGoto"
	])

	registerKeybinds(toRegister)
}

/**
 * Get commands from the app commands by their id.
 *
 * See {@linkcode appCommandsBase}
 */
export function pickCommands(
	ids: readonly AppCommandID[]
): readonly AppCommand[] {
	return (
		ids
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			.map((id) => [id, appConfig.keybindings.get(id)!] as const)
			.map(([id, data]) => ({ id, ...data, callback: getCommandCallback(id) }))
	)
}
