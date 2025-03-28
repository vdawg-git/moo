import type { AppCommandID } from "./commandsBase"
import { openRunner } from "#/components/runner/runner"
import { appState } from "#/state/state"
import { firstValueFrom } from "rxjs"
import { currentTrack$ } from "#/state/derivedState"
import { KeybindsModal } from "#/components/keybindsModal"

const lookupFunction: Readonly<Record<AppCommandID, () => void>> =
	Object.freeze({
		"runner.openCommands": () => openRunner(">"),
		"runner.openGoto": () => openRunner(),

		showKeybinds: () => {
			appState.send({
				type: "addModal",
				modal: { id: "Keybinds", title: "Keybinds", Content: KeybindsModal }
			})
		},

		"player.next": () => appState.send({ type: "nextTrack" }),
		"player.playPrevious": () => appState.send({ type: "previousTrack" }),
		"player.togglePlayback": () => appState.send({ type: "togglePlayback" }),

		"player.seekForward": async () => {
			const track = await firstValueFrom(currentTrack$)
			return track?.seek(5)
		},

		"player.seekBackward": async () => {
			const track = await firstValueFrom(currentTrack$)
			// A bit longer bc when we seek forward
			// and then decide to go back, some seconds have already passed
			return track?.seek(-7)
		},

		"player.toggleShuffle": () => appState.send({ type: "toggleShuffle" })
	})

export function getCommandCallback(id: AppCommandID): () => void {
	return lookupFunction[id]
}
