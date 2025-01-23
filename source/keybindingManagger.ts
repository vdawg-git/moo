import { useApp, useInput, type Key } from "tuir"
import { appConfig } from "./config/config"
import { logg } from "./logs"
import { useEffect, useState } from "react"
import { Subject } from "rxjs"
import { omitBy, pickBy } from "remeda"
import type { Keybinding } from "./config/shortcutParser"

/** This is a mirror of the internal `SpecialKeys`,
 * which does not get exported, but used in `useInput` */
type SpecialKeySet = Omit<Record<keyof typeof Key | "ctrl", boolean>, "sigint">
type InputData = { key: string; specialKeys: SpecialKeySet }

/**
 * This is currently only for global keybinds.
 * All configurable keybinds are global right now.
 *
 * Later we want to support multiple instances of this,
 * in different contexts ('when' property in the keybinds)
 */
export function manageKeybinds() {
	const { exit } = useApp()

	const [inputs$] = useState(new Subject<InputData>())
	useInput((key, specialKeys) => inputs$.next({ key, specialKeys }))

	// I need to convert " " to "space" or vice versa
	// I need to filter out keys by chord, and keep that updated
	//
	// Ideally some UI which shows the possible next combinations
	//
	useEffect(() => {
		// I need to map the chords to events,
		// that is filter out possible chords/commands
		// based on what has been pressed.
		// If no valid combination has been pressed, reset.
		// If what has been pressed would not trigger anything, ignore/reset.
		const subscription = inputs$.subscribe(({ key, specialKeys }) =>
			logg.debug("input", {
				key,
				specialKeys: pickBy(specialKeys, (isSet) => isSet)
			})
		)

		return () => subscription.unsubscribe()
	}, [inputs$])

	const keybinds = appConfig.keybindings

	// const { useEvent } = useKeymap({
	// 	next: { input: appConfig.keybindings.playNext },
	// 	previous: { input: appConfig.keybindings.playPrevious },
	// 	togglePlayback: { input: appConfig.keybindings.togglePlayback },
	// 	exit: { input: "c", key: "ctrl" }
	// })

	// useEvent("next", () => appState.send({ type: "nextTrack" }))
	// useEvent("previous", () => appState.send({ type: "previousTrack" }))
	// useEvent("togglePlayback", () => appState.send({ type: "togglePlayback" }))
	// useEvent("exit", () => {
	// 	exit()
	// })
}

function tuirInputToChord({key, specialKeys}: InputData): Keybinding {
	const alt = '\u001b'
	const modifier: Keybinding['modifiers'] = specialKeys.ctrl ? ['ctrl']
}
