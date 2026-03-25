import type {
	KeybindManager,
	ResolvedCommand
} from "#/application/keybinds/keybindManager"
import type { AppCommandsMap } from "#/core/commands/appCommands"
import type { AppCommandID } from "#/core/commands/definitions"
import type { CommandCallbackGetterFn } from "#/shared/types/types"

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

	return registerKeybinds(toRegister)
}

/**
 * Get commands from the app commands by their id.
 */
function pickCommands(
	ids: readonly AppCommandID[],
	getCommandCallback: CommandCallbackGetterFn,
	keybindings: AppCommandsMap
): readonly ResolvedCommand[] {
	return ids.map((commandId) => {
		const data = keybindings.get(commandId)!

		return {
			commandId,
			label: data.label,
			keybindings: data.keybindings,
			callback: getCommandCallback(commandId)
		}
	})
}
