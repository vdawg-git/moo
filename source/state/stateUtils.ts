import type { TrackId } from "#/database/types"
import type { KeybindCommandWhen } from "#/keybindManager/keybindsState"
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

export function getKeybindsWhen(
	whens: AppState["keybindingWhen"]
): KeybindCommandWhen {
	return whens.at(-1)?.type ?? "default"
}
