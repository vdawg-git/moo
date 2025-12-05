import { useCallback } from "react"
import { Playbar } from "#/components/playbar"
import { PlaylistTitle } from "#/components/playlilstTitle"
import { Tracklist } from "#/components/tracklist"
import { appConfig } from "#/config/config"
import { database } from "#/database/database"
import { useQuery } from "#/database/useQuery"
import { useColors } from "#/hooks/useColors"
import { createQueryKey } from "#/queryKey"
import { playNewPlayback } from "#/state/state"
import { usePlaybackData, usePlayingIndex } from "#/state/useSelectors"
import type { ArtistId } from "#/database/types"

type ArtistPageProps = {
	id: ArtistId
}

export function ArtistPage({ id }: ArtistPageProps) {
	const query = useCallback(() => database.getArtist(id), [id])
	const response = useQuery(createQueryKey.artist(id), query)
	const playingIndex = usePlayingIndex({ type: "artist", id })
	const playback = usePlaybackData()
	const amount = response.data?.getOrNull()?.tracks.length
	const displayName = response.data?.getOrNull()?.name ?? id
	const colors = useColors()

	return (
		<>
			<box flexGrow={1} flexDirection="column">
				<PlaylistTitle
					title={displayName}
					tracksAmount={amount ?? 0}
					color={colors.artists}
					icon={appConfig.icons.artist}
				/>

				{response.isLoading ? (
					<text>Loading...</text>
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
