import { createContext, useContext, useEffect, useId, useRef } from "react"
import { isNonNullish } from "remeda"
import { useAppContext } from "#/app/context"
import { ZONE_DEFAULT } from "#/core/commands/appCommands"
import { resolveCommand } from "./keybindManager"
import type { ReactNode } from "react"
import type { CommandArgument } from "./keybindManager"
import type { KeybindZone } from "./keybindsState"

export type UseKeybindingsOptions = {
	/** By default true */
	enabled?: boolean
	allowDuringInput?: boolean
}

const ZoneContext = createContext<KeybindZone>(ZONE_DEFAULT)

export function useKeybindings(
	getCommands: () => readonly CommandArgument[],
	options?: UseKeybindingsOptions
): void {
	const isEnabled = options?.enabled ?? true

	const commandsRef = useRef(
		null as unknown as () => readonly CommandArgument[]
	)
	commandsRef.current = getCommands

	const zone = useZoneContext()
	const { keybindManager, config } = useAppContext()

	useEffect(() => {
		if (!isEnabled) return

		const resolved = commandsRef
			.current()
			.map((command) => resolveCommand(command, config.keybindings))
			.filter(isNonNullish)

		return keybindManager.registerKeybinds(resolved, {
			zone,
			allowDuringInput: options?.allowDuringInput
		})
	}, [
		isEnabled,
		zone,
		keybindManager,
		options?.allowDuringInput,
		config.keybindings
	])
}

/** Provides a zone context for keybindings */
export function ZoneProvider({
	children,
	zone,
	root
}: {
	children: ReactNode
	zone: string
	/** When true, ignores parent zone and starts a new tree */
	root?: boolean
}) {
	const id = useId()
	const parentZone = useZoneContext()
	const fullZone = root
		? (zone as KeybindZone)
		: (`${parentZone}.${zone}` as KeybindZone)
	const { appState } = useAppContext()

	// We update the global state so that the keybindManager can filter for the correct commands
	useEffect(() => {
		appState.trigger.registerZone({
			toRegister: { zone: fullZone, id }
		})

		return () => appState.trigger.unregisterZone({ id })
	})

	return <ZoneContext value={fullZone}>{children}</ZoneContext>
}

/** Just reads out the context of the nearest {@linkcode ZoneContext} */
function useZoneContext(): KeybindZone {
	return useContext(ZoneContext)
}
