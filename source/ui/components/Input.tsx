import { useColors } from "#/ui/hooks/useColors"
import { useInputCapture } from "#/ui/hooks/useInputCapture"
import type { InputProps } from "@opentui/react"
import type { ReactNode } from "react"

export type AppInputProps = InputProps

/** Wraps the input component to disable keybinds while it is focused */
export function Input(props: AppInputProps): ReactNode {
	const isFocused = useInputCapture(props.focused)
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
