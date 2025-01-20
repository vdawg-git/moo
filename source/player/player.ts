import type { Player } from "./types"
import { createMpvPlayer } from "./mpv"

export function createLocalPlayer(): Player {
	return createMpvPlayer()
}
