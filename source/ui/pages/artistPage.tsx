import { useCallback } from "react"
import { useAppContext } from "#/app/context"
import { createQueryKey } from "#/shared/queryKey"
import { LoadingText } from "#/ui/components/loadingText"
import { Playbar } from "#/ui/components/playbar"
import { PlaylistTitle } from "#/ui/components/playlistTitle"
import { Tracklist } from "#/ui/components/tracklist"
import { useColors } from "#/ui/hooks/useColors"
import { useIcons } from "#/ui/hooks/useIcons"
import { useQuery } from "#/ui/hooks/useQuery"
import { usePlaybackData, usePlayingIndex } from "#/ui/hooks/useSelectors"
import type { ArtistId } from "#/ports/database"

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
	const icons = useIcons()

	return (
		<>
			<box flexGrow={1} flexDirection="column">
				<PlaylistTitle
					title={displayName}
					tracksAmount={amount ?? 0}
					color={colors.artists}
					icon={icons.artist}
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
									key={id}
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
