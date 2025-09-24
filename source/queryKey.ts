import type { PlaylistId } from "./database/types"

export const queryKeyBase = {
	playlist: "playlist"
}

export const createQueryKey = {
	playlist: (id: PlaylistId) => [queryKeyBase.playlist, id]
}
