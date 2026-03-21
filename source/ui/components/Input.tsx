import { useSelector } from "@xstate/store/react"
import { useEffect, useId } from "react"
import { useColors } from "#/ui/hooks/useColors"
import { useAppState } from "#/ui/hooks/useSelectors"
import type { InputProps } from "@opentui/react"
import type { ReactNode } from "react"

export type AppInputProps = InputProps

// We wrap the input component disable keybindins while it is focused
export function Input(props: AppInputProps): ReactNode {
	const { focused } = props
	const id = useId()
	const appState = useAppState()
	const currentlyFocused = useSelector(appState, ({ context }) =>
		context.focusedInputs.at(-1)
	)

	useEffect(() => {
		if (focused) {
			appState.trigger.addFocusedInput({ id })
			return () => appState.trigger.removeFocusedInput({ id })
		}
	}, [focused, id, appState])

	const isFocused = focused && currentlyFocused === id
	const colors = useColors()

	return (
		<input
			placeholderColor={colors.black}
			textColor={colors.brightBlack}
			focusedTextColor={colors.fg}
			cursorColor={colors.fg}
			{...props}
			focused={isFocused}
		/>
	)
}
