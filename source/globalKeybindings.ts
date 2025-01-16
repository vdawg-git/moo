import { useApp, useKeymap } from "tuir"
import { appConfig } from "./config/config"
import { appState } from "./state/state"

export function useGlobalKeybindings() {
	const { exit } = useApp()
	const { useEvent } = useKeymap({
		next: { input: appConfig.keybindings.playNext },
		previous: { input: appConfig.keybindings.playPrevious },
		togglePlayback: { input: appConfig.keybindings.togglePlayback },
		exit: { input: "c", key: "ctrl" }
	})

	useEvent("next", () => appState.send({ type: "nextTrack" }))
	useEvent("previous", () => appState.send({ type: "previousTrack" }))
	useEvent("togglePlayback", () => appState.send({ type: "togglePlayback" }))
	useEvent("exit", () => {
		exit()
		process.exit(0)
	})
}
