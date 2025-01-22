import type { Player } from "./types"
import { createMpvPlayer } from "./mpv"

/**
 * Plays local files
 */
export function createLocalPlayer(): Player {
	return createMpvPlayer()
}
