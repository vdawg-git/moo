import { useInputCapture } from "#/ui/hooks/useInputCapture"
import type { SelectProps } from "@opentui/react"
import type { ReactNode } from "react"

/** Wraps the select component to disable global keybinds while it is focused */
export function Select(props: SelectProps): ReactNode {
	const isFocused = useInputCapture(props.focused)

	return <select {...props} focused={isFocused} />
}
