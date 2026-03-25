import type { Simplify } from "type-fest"
import type {
	AppCommandData as AppCommandBaseData,
	AppCommandID
} from "./definitions"

export type KeybindZone = string & { __brand: "KeybindZone" }

export const ZONE_DEFAULT = "default" as KeybindZone
export const ZONE_MODAL = "modal" as KeybindZone

/**
 * A user command without a callback yet
 */
export type AppCommandBase = { id: AppCommandID } & AppCommandBaseData
export type AppCommand = Simplify<AppCommandBase & { callback: () => void }>

/**
 * A map with user commands which can later be executed via the runner or shortcuts.
 *
 * Does not include the callbacks for the commands
 */
export type AppCommandsMap = Map<AppCommandID, AppCommandBaseData>
