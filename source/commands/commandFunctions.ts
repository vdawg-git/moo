import { appConfig } from "#/config/config"
import { registerKeybinds } from "#/keybindManager/keybindManager"
import { getCommandCallback } from "./commandsCallbacks"
import type { AppCommand } from "./appCommands"
import type { AppCommandID } from "./commandsBase"

/**
 * Registers the keybinds for the global commands
 */
export function registerGlobalCommands() {
	const toRegister = pickCommands([
		"showKeybinds",
		"runner.openCommands",
		"runner.openGoto",
		"player.toggleShuffle"
	])

	registerKeybinds(toRegister, { when: "default" })
}

/**
 * Get commands from the app commands by their id.
 */
export function pickCommands(
	ids: readonly AppCommandID[]
): readonly AppCommand[] {
	return ids
		.map((id) => [id, appConfig.keybindings.get(id)!] as const)
		.map(([id, data]) => ({ id, ...data, callback: getCommandCallback(id) }))
}
