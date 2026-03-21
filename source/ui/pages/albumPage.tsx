import { useCallback } from "react"
import { useAppContext } from "#/app/context"
import { LoadingText } from "#/ui/components/loadingText"
import { Playbar } from "#/ui/components/playbar"
import { PlaylistTitle } from "#/ui/components/playlistTitle"
import { Tracklist } from "#/ui/components/tracklist"
import { useConfig } from "#/shared/config/configContext"
import { useQuery } from "#/ui/hooks/useQuery"
import { useColors } from "#/ui/hooks/useColors"
import { createQueryKey } from "#/shared/queryKey"
import { usePlaybackData, usePlayingIndex } from "#/ui/hooks/useSelectors"
import type { AlbumId } from "#/ports/database"

type AlbumPageProps = {
	id: AlbumId
}

export function AlbumPage({ id }: AlbumPageProps) {
	const { database, playNewPlayback } = useAppContext()
	const queryFn = useCallback(() => database.getAlbum(id), [id, database])
	const response = useQuery(createQueryKey.album(id), queryFn)
	const playingIndex = usePlayingIndex({ type: "album", id })
	const playback = usePlaybackData()
	const amount = response.data?.getOrNull()?.tracks.length
	const displayName = response.data?.getOrNull()?.title ?? id
	const colors = useColors()
	const config = useConfig()

	return (
		<>
			<box flexGrow={1} flexDirection="column">
				<PlaylistTitle
					title={displayName}
					tracksAmount={amount ?? 0}
					color={colors.albums}
					icon={config.icons.album}
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
											source: { type: "album", id },
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
