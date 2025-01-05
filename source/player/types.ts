// To get polymorphism with streaming services,
// providers need to also provide a player for the service

import type { Observable } from "rxjs"

// rn, this is overkill, but it would be cool to have this with a plugin system
// so that a plugin provides DB and player for for example Spotify
export interface Player {
	// Do we need to play a single track?
	// Isn't it always a playlist?
	// A single track playlist could also be possible
	playTrack: (
		/** The ID of the track to play */
		id: string,
	) => Promise<void>
	pauseTrack: () => Promise<void>
	togglePlayback: () => Promise<void>
	/** Completes when the track has ended */
	progress$: Observable<number>
}
