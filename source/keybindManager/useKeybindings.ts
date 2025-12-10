import { useEffect, useRef } from "react"
import { registerKeybinds } from "./keybindManager"
import type { GeneralCommand } from "#/commands/appCommands"

export type UseKeybindingsOptions = {
	/** By default true */
	enabled?: boolean
}

export function useKeybindings(
	getCommands: () => readonly GeneralCommand[],
	options?: UseKeybindingsOptions
): void {
	const isEnabled = options?.enabled ?? true

	const commandsRef = useRef(null as unknown as () => readonly GeneralCommand[])
	commandsRef.current = getCommands

	useEffect(() => {
		if (!isEnabled) return

		return registerKeybinds(commandsRef.current())
	}, [isEnabled])
}
