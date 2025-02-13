import { openRunner } from "#/components/runner/runner"
import type { KeyInput } from "#/config/shortcutParser"
import { currentTrack$ } from "#/state/derivedState"
import { appState } from "#/state/state"
import { firstValueFrom } from "rxjs"

/**
 * A user command which can be executed via the runner or shortcuts.
 */
export type AppCommand = Readonly<{
	/**
	 * The unique ID of the command
	 * */
	id: string
	/**
	 * It is an array to support sequencing keys.
	 */
	keybinding: readonly KeyInput[]
	/**
	 * The description of the command.
	 * Should be used in the config schema and the docs.
	 */
	description: string
	/**
	 * The display label shown in the TUI
	 * Might not be unique .
	 */
	label: string

	/**
	 * The function to execute when the command gets executed.
	 */
	callback: () => void

	// would be cool to later support the where property, too
	// where?: string
}>

/**
 * The user commands for the app.
 */
export const appCommands = [
	{
		// ids starting with `runner.` get filtered out by the runner itself
		id: "runner.openCommands",
		label: "Open runner",
		keybinding: [{ key: ":", modifiers: [] }],
		description:
			"Open the command runner from which you can access all commands for the app.",
		callback: () => openRunner(">")
	},
	{
		id: "runner.openGoto",
		label: "Go to..",
		keybinding: [{ key: ";", modifiers: [] }],
		description:
			"Open the switcher from where you can go to different parts of your library.",
		callback: () => openRunner()
	},

	{
		id: "player.next",
		label: "Play next",
		description: "Plays the next song in the queue",
		keybinding: [{ key: "l", modifiers: [] }],
		callback: () => appState.send({ type: "nextTrack" })
	},

	{
		id: "player.playPrevious",
		label: "Play previous",
		keybinding: [{ key: "h", modifiers: [] }],
		description: "Global keybinding. Plays the previous track in the queue.",
		callback: () => appState.send({ type: "previousTrack" })
	},

	{
		id: "player.togglePlayback",
		label: "Toggle play",
		keybinding: [{ key: "space", modifiers: [] }],
		description:
			"Global keybinding. Toggles the playback from pause to play and vice versa.",
		callback: () => appState.send({ type: "togglePlayback" })
	},

	{
		id: "player.seekForward",
		label: "Seeks forward",
		keybinding: [{ key: "L", modifiers: [] }],
		description: "Seeks forward a couple of seconds.",
		callback: async () => {
			const track = await firstValueFrom(currentTrack$)
			return track?.seek(5)
		}
	},
	{
		id: "player.seekBackward",
		label: "Seeks backward",
		keybinding: [{ key: "H", modifiers: [] }],
		description: "Seeks backward a couple of seconds.",
		callback: async () => {
			const track = await firstValueFrom(currentTrack$)
			// A bit longer bc when we seek forward
			// and then decide to go back some seconds have already passed
			return track?.seek(-7)
		}
	},

	{
		// TODO not implemented yet. First implement artists, albums etc
		id: "goTo.playlists",
		label: "Open playlist",
		keybinding: [
			{ key: "g", modifiers: [] },
			{ key: "p", modifiers: [] }
		],
		description: "Open a modal to quickly switch to a playlist.",
		callback: () => openRunner("p ")
	}
] as const satisfies AppCommand[]

/**
 * The IDs of the available commands
 * See {@link appCommands }
 */
export type CommandID = (typeof appCommands)[number]["id"]
