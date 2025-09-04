import type { TrackId } from "#/database/types"
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
