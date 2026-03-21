import { createMpvPlayer } from "./mpv"
import type { Player } from "#/ports/player"

/**
 * Plays local files
 */
export function createLocalPlayer(): Player {
	return createMpvPlayer()
}
