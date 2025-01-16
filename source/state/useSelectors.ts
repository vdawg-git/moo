import { useSelector } from "@xstate/store/react"
import { appState, type PlaybackSource } from "./state"
import type { Track } from "#/database/types"
import type { PlayingState } from "#/types/types"
import { deepEquals } from "bun"

export const useCurrentTrack: () => Track | undefined = () =>
	useSelector(appState, (snapshot) => {
		const index = snapshot.context.playback.index
		const tracks = snapshot.context.playback.queue?.tracks

		return tracks?.[index]
	})

export const usePlaybackState: () => PlayingState = () =>
	useSelector(appState, (snapshot) => snapshot.context.playback.playState)

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
