import type { BaseTrack } from "#/database/types"
import type { AppState } from "./state"

export function getCurrentTrackFromState({
	index,
	queue,
	manuallyAdded,
	isPlayingFromManualQueue
}: AppState["playback"]): BaseTrack | undefined {
	if (isPlayingFromManualQueue) {
		return manuallyAdded[index]
	}

	return queue?.tracks[index]
}
