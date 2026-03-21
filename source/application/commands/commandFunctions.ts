import type { KeybindManager } from "#/application/keybinds/keybindManager"
import type { CommandCallbackGetterFn } from "#/shared/types/types"
import type { AppCommand, AppCommandsMap } from "#/core/commands/appCommands"
import type { AppCommandID } from "#/core/commands/definitions"

/**
 * Registers the keybinds for the global commands
 */
export function registerGlobalCommands({
	registerKeybinds,
	getCommandCallback,
	keybindings
}: {
	readonly registerKeybinds: KeybindManager["registerKeybinds"]
	readonly getCommandCallback: CommandCallbackGetterFn
	readonly keybindings: AppCommandsMap
}): () => void {
	const toRegister = pickCommands(
		[
			"showKeybinds",
			"runner.openCommands",
			"runner.openGoto",
			"player.toggleShuffle"
		],
		getCommandCallback,
		keybindings
	)

	return registerKeybinds(toRegister, { when: "default" })
}

/**
 * Get commands from the app commands by their id.
 */
function pickCommands(
	ids: readonly AppCommandID[],
	getCommandCallback: CommandCallbackGetterFn,
	keybindings: AppCommandsMap
): readonly AppCommand[] {
	return ids
		.map((id) => [id, keybindings.get(id)!] as const)
		.map(([id, data]) => ({ id, ...data, callback: getCommandCallback(id) }))
}
