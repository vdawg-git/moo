import { useSelector } from "@xstate/store/react"
import { deepEquals } from "bun"
import { useAppContext } from "#/app/context"
import { useBehaviorSubject, useObservable } from "#/ui/hooks/useObservable"
import type { AppState, PlaybackSource } from "#/core/state/types"
import type { BaseTrack } from "#/ports/database"
import type { PlayingState } from "#/shared/types/types"

// /
// Hooks for the global state.
// You can also just use `useSelector` from XState directly, but those are nicer
// /

/** Convenience hook — returns appState store from context */
export function useAppState() {
	return useAppContext().appState
}

export function useCurrentTrack(): BaseTrack | undefined {
	const { derived } = useAppContext()
	const currentTrack = useObservable(derived.currentTrack$)

	return currentTrack
}

export function usePlayState(): PlayingState {
	const appState = useAppState()

	return useSelector(appState, ({ context }) => context.playback.playState)
}

export function useShuffleMap(): readonly number[] | undefined {
	const appState = useAppState()

	return useSelector(appState, ({ context }) => context.playback.shuffleMap)
}

export function usePlayProgress(): number {
	const { derived } = useAppContext()

	return useBehaviorSubject(derived.progress$)
}

export function usePlaybackQueue(): AppState["playback"] {
	const appState = useAppState()

	return useSelector(appState, ({ context }) => context.playback)
}

/**
 * Returns the index of the currently playing track from the given source.
 *
 * Used by for example a playlist tracklist to determine if it is currently played.
 *
 * Returns undefined if the specified source is currently not playing.
 */
export function usePlayingIndex(source: PlaybackSource): number | undefined {
	const appState = useAppState()

	return useSelector(appState, ({ context: { playback } }) => {
		const currentSource = playback.queue?.source
		if (!currentSource) return undefined

		const isSourcePlaying = deepEquals(source, currentSource)

		return isSourcePlaying ? playback.index : undefined
	})
}
