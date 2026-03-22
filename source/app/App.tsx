import { useEffect } from "react"
import { createCommandCallbacks } from "#/application/commands/callbacks"
import { manageNotifications } from "#/application/notifications"
import { handleAudioPlayback } from "#/application/playback/playback"
import { useConfig } from "#/shared/config/configContext"
import { callAll } from "#/shared/helpers"
import { ModalManager } from "#/ui/components/modalManager"
import { Router } from "#/ui/components/router"
import { NextUpKeybinds } from "#/ui/components/sequenceKeybindsShower"
import { ThemeProvider } from "#/ui/hooks/useColors"
import { useAppContext } from "./context"

export const App = () => {
	const context = useAppContext()
	const config = useConfig()

	// oxlint-disable eslint-plugin-react-hooks(exhaustive-deps) — context is stable, created once at startup
	useEffect(() => {
		const { getCommandCallback } = createCommandCallbacks({
			appState: context.appState,
			player: context.player
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
