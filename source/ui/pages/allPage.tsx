import { useAppContext } from "#/app/context"
import { createQueryKey } from "#/shared/queryKey"
import { LoadingText } from "#/ui/components/loadingText"
import { Playbar } from "#/ui/components/playbar"
import { PlaylistTitle } from "#/ui/components/playlistTitle"
import { Tracklist } from "#/ui/components/tracklist"
import { useColors } from "#/ui/hooks/useColors"
import { useQuery } from "#/ui/hooks/useQuery"
import {
	usePlayingIndex,
	usePlayState,
	useShuffleMap
} from "#/ui/hooks/useSelectors"

export function All() {
	const { database, playNewPlayback } = useAppContext()
	const response = useQuery(createQueryKey.all(), database.getTracks)
	const shuffleMap = useShuffleMap()
	const playingIndex = usePlayingIndex({ type: "all" })
	const playState = usePlayState()
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
								shuffleMap={shuffleMap}
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
