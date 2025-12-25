import { useEffect } from "react"
import { ModalManager } from "./components/modalManager"
import { Router } from "./components/router"
import { NextUpKeybinds } from "./components/sequenceKeybindsShower"
import { callAll } from "./helpers"
import { ThemeProvider } from "./hooks/useColors"
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
		<ThemeProvider>
			<box flexDirection="column" height={"100%"} overflow="scroll">
				<Router />

				<ModalManager />
				<NextUpKeybinds />
			</box>
		</ThemeProvider>
	)
}
