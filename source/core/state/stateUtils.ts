import { ZONE_DEFAULT } from "#/core/commands/appCommands"
import type { KeybindZone } from "#/core/commands/appCommands"
import type { TrackId } from "#/shared/types/brandedIds"
import type { AppState } from "./types"

export type CurrentTrack = {
	readonly trackId: TrackId
	readonly source: "auto" | "manual"
	readonly queueIndex: number
}

export function getCurrentTrack(
	playback: AppState["playback"]
): CurrentTrack | undefined {
	const { index, queue, manuallyAdded, isPlayingFromManualQueue } = playback

	if (isPlayingFromManualQueue) {
		const trackId = manuallyAdded[0]
		if (!trackId) return undefined

		return { trackId, source: "manual", queueIndex: 0 }
	}

	const trackId = queue?.tracks[index]
	if (!trackId) return undefined

	return { trackId, source: "auto", queueIndex: index }
}

export function getActiveZone(zones: AppState["activeZones"]): KeybindZone {
	return zones.at(-1)?.zone ?? ZONE_DEFAULT
}
