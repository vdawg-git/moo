import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useId,
	useRef
} from "react"
import { appState } from "#/state/state"
import { type GeneralCommandArgument, registerKeybinds } from "./keybindManager"
import type { KeybindCommandWhen } from "./keybindsState"

export type UseKeybindingsOptions = {
	/** By default true */
	enabled?: boolean
}

const KeybindingWhenContext = createContext<KeybindCommandWhen>("default")

export function useKeybindings(
	getCommands: () => readonly GeneralCommandArgument[],
	options?: UseKeybindingsOptions
): void {
	const isEnabled = options?.enabled ?? true

	const commandsRef = useRef(
		null as unknown as () => readonly GeneralCommandArgument[]
	)
	commandsRef.current = getCommands

	const keybindingsWhen = useKeybindingWhen()

	useEffect(() => {
		if (!isEnabled) return

		return registerKeybinds(commandsRef.current(), { when: keybindingsWhen })
	}, [isEnabled, keybindingsWhen])
}

export function KeybindingWhenProvider({
	children,
	when
}: {
	children: ReactNode
	when: KeybindCommandWhen
}) {
	const id = useId()

	// We update the global state so that the keybindManager can filter for the correct commands as updating it directly is kinda ugly
	useEffect(() => {
		appState.trigger.registerKeybindingWhen({ toRegister: { type: when, id } })

		return () => appState.trigger.unregisterKeybindWhen({ id })
	})

	return <KeybindingWhenContext value={when}>{children}</KeybindingWhenContext>
}

/** Just reads out the context of the nearest {@linkcode KeybindingWhenContext} */
export function useKeybindingWhen(): KeybindCommandWhen {
	return useContext(KeybindingWhenContext)
}
