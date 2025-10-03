import { createMpvPlayer } from "./mpv"
import type { Player } from "./types"

/**
 * Plays local files
 */
export function createLocalPlayer(): Player {
	return createMpvPlayer()
}
