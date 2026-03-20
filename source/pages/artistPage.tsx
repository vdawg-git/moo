import { useCallback } from "react"
import { useAppContext } from "#/appContext"
import { LoadingText } from "#/components/loadingText"
import { Playbar } from "#/components/playbar"
import { PlaylistTitle } from "#/components/playlilstTitle"
import { Tracklist } from "#/components/tracklist"
import { useConfig } from "#/config/configContext"
import { useQuery } from "#/database/useQuery"
import { useColors } from "#/hooks/useColors"
import { createQueryKey } from "#/queryKey"
import { usePlaybackData, usePlayingIndex } from "#/state/useSelectors"
import type { ArtistId } from "#/database/types"

type ArtistPageProps = {
	id: ArtistId
}

export function ArtistPage({ id }: ArtistPageProps) {
	const { database, playNewPlayback } = useAppContext()
	const queryFn = useCallback(() => database.getArtist(id), [id, database])
	const response = useQuery(createQueryKey.artist(id), queryFn)
	const playingIndex = usePlayingIndex({ type: "artist", id })
	const playback = usePlaybackData()
	const amount = response.data?.getOrNull()?.tracks.length
	const displayName = response.data?.getOrNull()?.name ?? id
	const colors = useColors()
	// refactor a useIcons hook would be nicer here
	const config = useConfig()

	return (
		<>
			<box flexGrow={1} flexDirection="column">
				<PlaylistTitle
					title={displayName}
					tracksAmount={amount ?? 0}
					color={colors.artists}
					icon={config.icons.artist}
				/>

				{response.isLoading ? (
					<LoadingText />
				) : (
					response.data.fold(
						(album) =>
							album ? (
								<Tracklist
									tracks={album.tracks}
									onPlay={(index) =>
										playNewPlayback({
											source: { type: "artist", id },
											index
										})
									}
									shuffleMap={playback.shuffleMap}
									playState={playback.playState}
									playingIndex={playingIndex}
									// A bit weird, but useList needs that
									key={JSON.stringify(album.tracks)}
								/>
							) : (
								"Album not found. Diz is a bug"
							),
						(error) => <text fg={colors.red}>Error: {String(error)}</text>
					)
				)}
			</box>

			<Playbar />
		</>
	)
}
