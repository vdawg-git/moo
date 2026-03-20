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
import type { AlbumId } from "#/database/types"

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
