import { useSelector } from "@xstate/store/react"
import { useEffect, useId } from "react"
import { useZoneContext } from "#/application/keybinds/useKeybindings"
import { useColors } from "#/ui/hooks/useColors"
import { useAppState } from "#/ui/hooks/useSelectors"
import type { InputProps } from "@opentui/react"
import type { ReactNode } from "react"

export type AppInputProps = InputProps

/** Wraps the input component to disable keybinds while it is focused */
export function Input(props: AppInputProps): ReactNode {
	const { focused } = props
	const id = useId()
	const appState = useAppState()
	const currentlyFocused = useSelector(appState, ({ context }) =>
		context.inputsCaptured.at(-1)
	)

	const myZone = useZoneContext()
	const activeZone = useSelector(
		appState,
		({ context }) => context.activeZones.at(-1)?.zone
	)
	const isInActiveZone =
		!activeZone || activeZone === myZone || activeZone.startsWith(myZone + ".")

	useEffect(() => {
		if (focused && isInActiveZone) {
			appState.trigger.addCapturedInput({ id })

			return () => appState.trigger.removeCapturedInput({ id })
		}
	}, [focused, isInActiveZone, id, appState])

	const isFocused = focused && currentlyFocused === id && isInActiveZone
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
