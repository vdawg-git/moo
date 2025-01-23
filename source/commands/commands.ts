import { openRunner } from "#/components/runner"
import type { Keybinding } from "#/config/shortcutParser"
import { appState, type AppState } from "#/state/state"

/**
 * A user command which can be executed via the runner or shortcuts.
 */
export type AppCommand = Readonly<{
	/**
	 * The unique ID of the command
	 * */
	id: string
	/**
	 * It is an array to support chording.
	 */
	keybinding: readonly Keybinding[]
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
	callback: (state: AppState) => void

	// would be cool to later support the where property, too
	// where?: string
}>

/**
 * The user commands for the app.
 */
export const appCommands = [
	{
		id: "runner.open",
		label: "Open runner",
		keybinding: [{ key: ":", modifiers: [] }],
		description:
			"Open the command runner from which you can access all commands for the app.",
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
	}
] as const satisfies AppCommand[]

/**
 * The IDs of the available commands
 * See {@link appCommands }
 */
export type CommandID = (typeof appCommands)[number]["id"]
