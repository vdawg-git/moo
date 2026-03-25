import { useAppContext } from "#/app/context"
import { useBehaviorSubject } from "./useObservable"
import type { KeySequence } from "#/application/keybinds/keybindManager"

/** Hook that subscribes to the key sequence result and returns the current sequence part */
export function useNextKeySequence(): KeySequence | undefined {
	const { keybindManager } = useAppContext()
	const nextUpCommands = useBehaviorSubject(keybindManager.sequence$)

	return nextUpCommands
}
