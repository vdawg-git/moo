import { appConfig } from "#/config/config"
import type { KeybindCommandWhen } from "#/keybindManager/keybindsState"
import type { Except, OverrideProperties, Simplify } from "type-fest"
import type {
	AppCommandData as AppCommandBaseData,
	AppCommandID
} from "./commandsBase"

/**
 * A user command without a callback yet
 */
export type AppCommandBase = { id: AppCommandID } & AppCommandBaseData
export type AppCommand = Simplify<AppCommandBase & { callback: () => void }>

/**
 * Can be a dynamic command registered by some UI component or a global app command.
 *
 * @see {@linkcode AppCommand}
 */
export type GeneralCommand = Except<
	OverrideProperties<AppCommand, { id: string }>,
	"description"
> & {
	/** Use a different when in for example modals, where the regular app commands should be disabled */
	when: KeybindCommandWhen
}

/**
 * A map with user commands which can later be executed via the runner or shortcuts.
 *
 * Does not include the callbacks for the commands
 */
export type AppCommandsMap = Map<AppCommandID, AppCommandBaseData>

export const appCommands: AppCommandsMap = appConfig.keybindings
