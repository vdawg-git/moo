import { useSelector } from "@xstate/store/react"
import { appState } from "./state"
import type { Track } from "#/database/types"
import type { PlayingState } from "#/types/types"

export const useCurrentTrack: () => Track | undefined = () =>
	useSelector(appState, (snapshot) => {
		const index = snapshot.context.playback.index
		const tracks = snapshot.context.playback.queue?.tracks

		return tracks?.[index]
	})

export const usePlaybackState: () => PlayingState = () =>
	useSelector(appState, (snapshot) => snapshot.context.playback.playState)
