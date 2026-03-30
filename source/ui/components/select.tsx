import { useSelector } from "@xstate/store/react"
import { useEffect, useId } from "react"
import { useZoneContext } from "#/application/keybinds/useKeybindings"
import { useAppState } from "#/ui/hooks/useSelectors"
import type { SelectProps } from "@opentui/react"
import type { ReactNode } from "react"

/** Wraps the select component to disable global keybinds while it is focused */
export function Select(props: SelectProps): ReactNode {
	const { focused } = props
	const id = useId()
	const appState = useAppState()
	const currentlyFocused = useSelector(appState, ({ context }) =>
		context.inputsCaptured.at(-1)
	)

	// todo refactor this into a hook as `input.tsx` is the same logic
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

	return <select {...props} focused={isFocused} />
}
