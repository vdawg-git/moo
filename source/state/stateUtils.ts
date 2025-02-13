import type { Track } from "#/database/types"
import type { AppState } from "./state"

export function getCurrentTrackFromState(state: AppState): Track | undefined {
	const index = state.playback.index
	const tracks = state.playback.queue?.tracks

	return tracks?.[index]
}
