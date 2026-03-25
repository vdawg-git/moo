import { KeybindsModal } from "#/ui/components/keybindsModal"
import { openRunner } from "#/ui/components/runner/runner"
import type { AppCommandID } from "#/core/commands/definitions"
import type { AppStore } from "#/core/state/state"
import type { Player } from "#/ports/player"
import type { CommandCallbackGetterFn } from "#/shared/types/types"

export type CommandCallbacks = {
	readonly getCommandCallback: CommandCallbackGetterFn
}

/** Creates command callbacks with injected dependencies */
export function createCommandCallbacks({
	appState,
	player
}: {
	readonly appState: AppStore
	readonly player: Player
}): CommandCallbacks {
	const lookupFunction: Readonly<Partial<Record<AppCommandID, () => void>>> =
		Object.freeze({
			"runner.openCommands": () => openRunner(appState, ">"),
			"runner.openGoto": () => openRunner(appState),

			showKeybinds: () => {
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

			"player.seekForward": () => {
				player.seek(5)
			},

			"player.seekBackward": () => {
				// A bit longer bc when we seek forward
				// and then decide to go back, some time has already passed
				player.seek(-7)
			},

			"player.toggleShuffle": () => appState.send({ type: "toggleShuffle" })
		})

	function getCommandCallback(id: AppCommandID): () => void {
		const callback = lookupFunction[id]
		if (!callback) {
			throw new Error(`No callback registered for command: ${id}`)
		}

		return callback
	}

	return { getCommandCallback }
}
