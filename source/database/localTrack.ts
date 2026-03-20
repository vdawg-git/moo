import { Track } from "./types.js"
import type { Player } from "../player/types.js"

export class LocalTrack extends Track {
	constructor(
		properties: Partial<LocalTrack> & { id: string },
		player: Player
	) {
		super(properties, player, "local")
	}
}
