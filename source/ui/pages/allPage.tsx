import { useSelector } from "@xstate/store/react"
import { useAppContext } from "#/app/context"
import { LoadingText } from "#/ui/components/loadingText"
import { Playbar } from "#/ui/components/playbar"
import { PlaylistTitle } from "#/ui/components/playlistTitle"
import { Tracklist } from "#/ui/components/tracklist"
import { useQuery } from "#/ui/hooks/useQuery"
import { useColors } from "#/ui/hooks/useColors"
import { createQueryKey } from "#/shared/queryKey"
import { usePlaybackData, usePlayingIndex } from "#/ui/hooks/useSelectors"

export function All() {
	const { database, playNewPlayback, appState } = useAppContext()
	const response = useQuery(createQueryKey.all(), database.getTracks)
	const playback = usePlaybackData()
	const playingIndex = usePlayingIndex({ type: "all" })
	const playState = useSelector(
		appState,
		(snapshot) => snapshot.context.playback.playState
	)
	const amount = response.data?.getOrNull()?.length
	const colors = useColors()

	return (
		<>
			<box flexGrow={1} flexDirection="column">
				<PlaylistTitle title={"All tracks"} tracksAmount={amount ?? 0} />

				{response.isLoading ? (
					<LoadingText />
				) : (
					response.data.fold(
						(tracks) => (
							<Tracklist
								tracks={tracks}
								playState={playState}
								shuffleMap={playback.shuffleMap}
								onPlay={(index) =>
									playNewPlayback({
										source: { type: "all" },
										index
									})
								}
								playingIndex={playingIndex}
							/>
						),
						(error) => <text fg={colors.red}>Error: {String(error)}</text>
					)
				)}
			</box>
			<Playbar />
		</>
	)
}
