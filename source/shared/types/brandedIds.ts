export type TrackId = string & { __brand: "TrackId" }
export type AlbumId = string & { __brand: "AlbumId" }
export type ArtistId = string & { __brand: "ArtistId" }
/**
 * For smart playlists it is the filename.
 * Currently we only have smart playlists though.
 */
export type PlaylistId = string & { __brand: "PlaylistId" }
