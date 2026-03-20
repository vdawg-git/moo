import { useEffect } from "react"
import { useAppContext } from "./appContext"
import { createCommandCallbacks } from "./commands/commandsCallbacks"
import { ModalManager } from "./components/modalManager"
import { Router } from "./components/router"
import { NextUpKeybinds } from "./components/sequenceKeybindsShower"
import { useConfig } from "./config/configContext"
import { callAll } from "./helpers"
import { ThemeProvider } from "./hooks/useColors"
import { handleAudioPlayback } from "./playback/playback"
import { manageNotifications } from "./state/stateReact"

export const App = () => {
	const context = useAppContext()
	const config = useConfig()

	// oxlint-disable eslint-plugin-react-hooks(exhaustive-deps) — context is stable, created once at startup
	useEffect(() => {
		const { getCommandCallback } = createCommandCallbacks({
			appState: context.appState,
			currentTrack$: context.derived.currentTrack$
		})

		const unsubscribers = [
			handleAudioPlayback({
				appState: context.appState,
				appState$: context.appState$,
				currentTrack$: context.derived.currentTrack$,
				playState$: context.derived.playState$,
				loop$: context.derived.loop$,
				player: context.player,
				addErrorNotification: context.notifications.addError,
				keybindManager: context.keybindManager,
				getCommandCallback,
				keybindings: config.keybindings
			}),
			manageNotifications({
				appState: context.appState,
				appState$: context.appState$
			}),
			context.keybindManager.handleKeybinds()
		]

		return () => callAll(unsubscribers)
	}, [])
	// oxlint-enable eslint-plugin-react-hooks(exhaustive-deps)

	return (
		<ThemeProvider>
			<box
				flexDirection="column"
				height={"100%"}
				width={"100%"}
				overflow="scroll"
			>
				<Router />

				<ModalManager />

				<NextUpKeybinds />
			</box>
		</ThemeProvider>
	)
}
