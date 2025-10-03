import { useEffect } from "react"
import { setCharRegisterSize, setMouseReporting, Viewport } from "tuir"
import { ModalManager } from "./components/modalManager"
import { Navigator } from "./components/navigator"
import { NextUpKeybinds } from "./components/sequenceKeybindsShower"
import { handleAudioPlayback } from "./playback/playback"
import { manageNotifications } from "./state/stateReact"

export const App = () => {
	setCharRegisterSize(1)
	useEffect(() => {
		const unsubscribes = [handleAudioPlayback(), manageNotifications()]
		setMouseReporting(true)

		return () => {
			setMouseReporting(false)
			unsubscribes.forEach((unsubscribe) => unsubscribe())
		}
	}, [])

	return (
		<Viewport flexDirection="column">
			<Navigator />

			<ModalManager />
			<NextUpKeybinds />
		</Viewport>
	)
}
