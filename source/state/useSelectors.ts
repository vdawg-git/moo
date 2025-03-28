import { useSelector } from "@xstate/store/react"
import { deepEquals } from "bun"
import type { BaseTrack } from "#/database/types"
import { type AppState, type PlaybackSource, appState } from "./state"
import { getCurrentTrackFromState } from "./stateUtils"

// /
// Hooks for the global state.
// You can also just use `useSelector` from XState directly
// /

export const useCurrentTrack: () => BaseTrack | undefined = () =>
	useSelector(appState, (snapshot) => {
		return getCurrentTrackFromState(snapshot.context.playback)
	})

export const usePlaybackData: () => AppState["playback"] = () =>
	useSelector(appState, (snapshot) => snapshot.context.playback)

/**
 * Returns the index of the currently playing track from the given source.
 *
 * Returns undefined if the specified source is not currently playing.
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
