import { getCurrentTrack } from "#/core/state/stateUtils"
import type { AppState } from "#/core/state/types"
import type { TrackId } from "#/ports/database"

export type QueueDisplayItem = {
	readonly type: "auto" | "manual"
	readonly trackId: TrackId
	/** Original index in the respective queue — needed for playIndex/remove actions */
	readonly queueIndex: number
	readonly playState: "playing" | "paused" | undefined
}

/** Computes the current + upcoming tracks for the queue page display. */
export function getQueueDisplayItems(
	playback: Omit<AppState["playback"], "progress">
): readonly QueueDisplayItem[] {
	const { queue, manuallyAdded, isPlayingFromManualQueue, index } = playback

	const item = (
		queueIndex: number,
		source: "auto" | "manual",
		playState?: "playing" | "paused"
	): QueueDisplayItem => ({
		type: source,
		trackId:
			source === "manual"
				? manuallyAdded[queueIndex]!
				: queue!.tracks[queueIndex]!,
		queueIndex,
		playState
	})

	const current = getCurrentTrack(playback)
	const currentItems =
		current && playback.playState !== "stopped"
			? [
					item(
						current.queueIndex,
						current.source,
						playback.playState === "playing" ? "playing" : "paused"
					)
				]
			: []

	const manualStart = isPlayingFromManualQueue ? 1 : 0
	const manualUpcoming = manuallyAdded
		.slice(manualStart)
		.map((_, offset) => item(manualStart + offset, "manual"))

	const autoUpcoming = (queue?.tracks.slice(index + 1) ?? []).map((_, offset) =>
		item(index + 1 + offset, "auto")
	)

	return [...currentItems, ...manualUpcoming, ...autoUpcoming]
}
