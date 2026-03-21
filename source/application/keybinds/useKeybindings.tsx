import { createContext, useContext, useEffect, useId, useRef } from "react"
import { useAppContext } from "#/app/context"
import type { ReactNode } from "react"
import type { GeneralCommandArgument } from "./keybindManager"
import type { KeybindCommandWhen } from "./keybindsState"

export type UseKeybindingsOptions = {
	/** By default true */
	enabled?: boolean
}

const KeybindingWhenContext = createContext<KeybindCommandWhen>("default")

// TODO passing an id is kinda useless. We can use just use `useId`+label
// The labels need to be unique though in the provided array
export function useKeybindings(
	getCommands: () => readonly GeneralCommandArgument[],
	options?: UseKeybindingsOptions
): void {
	const isEnabled = options?.enabled ?? true

	const commandsRef = useRef(
		null as unknown as () => readonly GeneralCommandArgument[]
	)
	commandsRef.current = getCommands

	const keybindingsWhen = useKeybindingContext()
	const { keybindManager } = useAppContext()

	useEffect(() => {
		if (!isEnabled) return

		return keybindManager.registerKeybinds(commandsRef.current(), {
			when: keybindingsWhen
		})
	}, [isEnabled, keybindingsWhen, keybindManager])
}

export function KeybindingWhenProvider({
	children,
	when
}: {
	children: ReactNode
	when: KeybindCommandWhen
}) {
	const id = useId()
	const { appState } = useAppContext()

	// We update the global state so that the keybindManager can filter for the correct commands as updating it directly is kinda ugly
	useEffect(() => {
		appState.trigger.registerKeybindingWhen({ toRegister: { type: when, id } })

		return () => appState.trigger.unregisterKeybindWhen({ id })
	})

	return <KeybindingWhenContext value={when}>{children}</KeybindingWhenContext>
}

/** Just reads out the context of the nearest {@linkcode KeybindingWhenContext} */
function useKeybindingContext(): KeybindCommandWhen {
	return useContext(KeybindingWhenContext)
}
