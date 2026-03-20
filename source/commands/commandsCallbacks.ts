import { firstValueFrom } from "rxjs"
import { KeybindsModal } from "#/components/keybindsModal"
import { openRunner } from "#/components/runner/runner"
import type { LocalTrack } from "#/database/localTrack"
import type { AppStore } from "#/state/state"
import type { CommandCallbackGetterFn } from "#/types/types"
import type { Observable } from "rxjs"
import type { AppCommandID } from "./commandsBase"

export type CommandCallbacks = {
	readonly getCommandCallback: CommandCallbackGetterFn
}

/** Creates command callbacks with injected dependencies */
export function createCommandCallbacks({
	appState,
	currentTrack$
}: {
	readonly appState: AppStore
	readonly currentTrack$: Observable<LocalTrack | undefined>
}): CommandCallbacks {
	const lookupFunction: Readonly<Record<AppCommandID, () => void>> =
		Object.freeze({
			"runner.openCommands": () => openRunner(appState, ">"),
			"runner.openGoto": () => openRunner(appState),

			showKeybinds: () => {
				// refactor-later use appState.trigger instead of `send`. Its nicer to read. Or do you have other thoughts? I mean replace it everywhere in the app
				appState.send({
					type: "addModal",
					modal: {
						id: "Keybinds",
						title: "Keybinds",
						Content: KeybindsModal
					}
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
				// and then decide to go back, some time has already passed
				return track?.seek(-7)
			},

			"player.toggleShuffle": () => appState.send({ type: "toggleShuffle" })
		})

	function getCommandCallback(id: AppCommandID): () => void {
		return lookupFunction[id]
	}

	return { getCommandCallback }
}
