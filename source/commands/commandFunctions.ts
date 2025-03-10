import { appConfig } from "#/config/config"
import * as R from "remeda"
import type { AppCommand } from "./appCommands"
import type { AppCommandID, appCommandsBase } from "./commandsBase"
import { registerKeybinds } from "#/keybindManager/KeybindManager"
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
	return appConfig.keybindings
		.entries()
		.filter(([id]) => ids.includes(id))
		.map(([id, data]) => ({ id, ...data, callback: getCommandCallback(id) }))
		.toArray()
}
