import type { TrackId } from "#/database/types"
import type { KeybindCommandWhen } from "#/keybindManager/keybindsState"
import type { AppState } from "./types"

export function getCurrentTrackIdFromState({
	index,
	queue,
	manuallyAdded,
	isPlayingFromManualQueue
}: AppState["playback"]): TrackId | undefined {
	if (isPlayingFromManualQueue) {
		return manuallyAdded[0]
	}

	return queue?.tracks[index]
}

export function getKeybindsWhen(
	whens: AppState["keybindingWhen"]
): KeybindCommandWhen {
	return whens.at(-1)?.type ?? "default"
}
