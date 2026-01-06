import type { AlbumId, ArtistId, PlaylistId, TrackId } from "./database/types"

const queryKeyBase = {
	playlist: "playlist",
	album: "album",
	artist: "artist",
	track: "track",
	tracks: "tracks"
}

export const createQueryKey = {
	playlist: (id: PlaylistId) => [queryKeyBase.playlist, id],
	album: (id: AlbumId) => [queryKeyBase.album, id],
	artist: (id: ArtistId) => [queryKeyBase.artist, id],
	track: (id: TrackId) => [queryKeyBase.track, id],
	tracks: (ids: readonly TrackId[]) => [queryKeyBase.tracks, ...ids],
	all: () => ["all"],
	quickEdit: (id: TrackId) => ["quickEdit", id]
}
