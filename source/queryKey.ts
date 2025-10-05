import type { AlbumId, ArtistId, PlaylistId } from "./database/types"

const queryKeyBase = {
	playlist: "playlist",
	album: "album",
	artist: "artist"
}

export const createQueryKey = {
	playlist: (id: PlaylistId) => [queryKeyBase.playlist, id],
	album: (id: AlbumId) => [queryKeyBase.album, id],
	artist: (id: ArtistId) => [queryKeyBase.artist, id]
}
