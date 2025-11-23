import { useEffect } from "react"
import { ModalManager } from "./components/modalManager"
import { Navigator } from "./components/navigator"
import { NextUpKeybinds } from "./components/sequenceKeybindsShower"
import { callAll } from "./helpers"
import { handleKeybinds } from "./keybindManager/keybindManager"
import { handleAudioPlayback } from "./playback/playback"
import { manageNotifications } from "./state/stateReact"

export const App = () => {
	useEffect(() => {
		const unsubscribers = [
			handleAudioPlayback(),
			manageNotifications(),
			handleKeybinds()
		]

		return () => callAll(unsubscribers)
	}, [])

	return (
		<box flexDirection="column" height={"100%"} overflow="scroll">
			<Navigator />

			<ModalManager />
			<NextUpKeybinds />
		</box>
	)
}
