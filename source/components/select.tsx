import { useSelector } from "@xstate/store/react"
import { useEffect, useId } from "react"
import { appState } from "#/state/state"
import type { SelectProps } from "@opentui/react"
import type { ReactNode } from "react"

/** Just the select component wrapped to disable global keybinds while it is focused */
export function Select(props: SelectProps): ReactNode {
	const { focused } = props
	const id = useId()
	const currentlyFocused = useSelector(appState, ({ context }) =>
		context.focusedInputs.at(-1)
	)

	useEffect(() => {
		if (focused) {
			appState.trigger.addFocusedInput({ id })
			return () => appState.trigger.removeFocusedInput({ id })
		}
	}, [focused, id])

	const isFocused = focused && currentlyFocused === id

	return <select {...props} focused={isFocused} />
}
