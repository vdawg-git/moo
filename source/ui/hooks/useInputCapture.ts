import { useSelector } from "@xstate/store/react"
import { useEffect, useId } from "react"
import { useZoneContext } from "#/application/keybinds/useKeybindings"
import { useAppState } from "#/ui/hooks/useSelectors"

/** Returns whether the input is truly focused, handling zone-aware capture registration */
export function useInputCapture(focused: boolean | undefined): boolean {
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

	return !!focused && currentlyFocused === id && isInActiveZone
}
