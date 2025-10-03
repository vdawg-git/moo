import { useSelector } from "@xstate/store/react"
import { deepEquals } from "bun"
import { useObservable } from "#/hooks/hooks"
import { currentTrack$ } from "./derivedState"
import { appState } from "./state"
import type { BaseTrack } from "#/database/types"
import type { AppState, PlaybackSource } from "./types"

// /
// Hooks for the global state.
// You can also just use `useSelector` from XState directly
// /

export function useCurrentTrack(): BaseTrack | undefined {
	const currentTrack = useObservable(currentTrack$)

	return currentTrack
}

export const usePlaybackData: () => AppState["playback"] = () =>
	useSelector(appState, (snapshot) => snapshot.context.playback)

/**
 * Returns the index of the currently playing track from the given source.
 *
 * Used by for example a playlist tracklist to determine if it is currently played.
 *
 * Returns undefined if the specified source is currently not playing.
 */
export const usePlayingIndex: (source: PlaybackSource) => number | undefined = (
	source
) =>
	useSelector(appState, ({ context: { playback } }) => {
		const currentSource = playback.queue?.source
		if (!currentSource) return undefined

		const isSourcePlaying = deepEquals(source, currentSource)

		return isSourcePlaying ? playback.index : undefined
	})
