import { keybinding } from "#/shared/library/keybinds"
import type { KeyBinding } from "#/shared/library/keybinds"

/**
 * Used for the keybindings config schema generation
 * and to generate the ID type union
 */
type AppCommandBase = Record<string, AppCommandData>
export type AppCommandData = {
	/**
	 * It is an array to support sequencing keys and again an array to support multiple bindings for the same command.
	 *
	 * The binding is from the user config or it is the default one if not specified.
	 *
	 * It can also be `undefined` if neither are specified.
	 */
	keybindings: readonly KeyBinding[]
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
	/** Zone this command belongs to, for grouping in the keybinds modal */
	zone?: string
}

const zones = {
	quickEdit: "quickEdit",
	runner: "runner"
} as const

export const appCommandsBase = Object.freeze({
	"runner.openCommands": {
		label: "Open runner",
		keybindings: keybinding(":"),
		description:
			"Open the command runner from which you can access all commands for the app."
	},

	"runner.openGoto": {
		label: "Go to..",
		keybindings: keybinding(";"),
		description:
			"Open the switcher from where you can go to different parts of your library."
	},

	"player.next": {
		label: "Play next",
		description: "Plays the next song in the queue",
		keybindings: keybinding("l")
	},

	"player.playPrevious": {
		label: "Play previous",
		keybindings: keybinding("h"),
		description: "Global keybinding. Plays the previous track in the queue."
	},

	"player.togglePlayback": {
		label: "Toggle play",
		keybindings: keybinding("space"),
		description:
			"Global keybinding. Toggles the playback from pause to play and vice versa."
	},

	"player.seekForward": {
		label: "Seeks forward",
		keybindings: keybinding("L"),
		description: "Seeks forward a couple of seconds."
	},

	"player.seekBackward": {
		label: "Seeks backward",
		keybindings: keybinding("H"),
		description: "Seeks backward a couple of seconds."
	},

	"player.toggleShuffle": {
		label: "Toggle shuffle",
		keybindings: keybinding("s"),
		description: "Toggles the shuffle mode on/off."
	},

	showKeybinds: {
		label: "Show keybindings",
		keybindings: keybinding("?"),
		description: "Show all keybinds"
	},

	abort: {
		keybindings: keybinding("esc"),
		label: "Abort",
		description: "Context-dependent escape: blur input or go back"
	},

	accept: {
		keybindings: keybinding("return"),
		label: "Accept",
		description: "Usually a regular 'enter' action"
	},

	// QuickEdit zone commands
	"quickEdit.removeTag": {
		keybindings: keybinding("x"),
		label: "Remove tag",
		description: "Remove the focused applied tag",
		zone: zones.quickEdit
	},
	"quickEdit.nextSuggestion": {
		keybindings: keybinding(["j", "down"]),
		label: "Next suggestion",
		description: "Move to the next suggestion",
		zone: zones.quickEdit
	},
	"quickEdit.previousSuggestion": {
		keybindings: keybinding(["k", "up"]),
		label: "Previous suggestion",
		description: "Move to the previous suggestion",
		zone: zones.quickEdit
	},
	"quickEdit.nextApplied": {
		keybindings: keybinding(["l", "right"]),
		label: "Next applied tag",
		description: "Move to the next applied tag",
		zone: zones.quickEdit
	},
	"quickEdit.previousApplied": {
		keybindings: keybinding(["h", "left"]),
		label: "Previous applied tag",
		description: "Move to the previous applied tag",
		zone: zones.quickEdit
	},
	// Runner zone commands
	"runner.nextItem": {
		keybindings: keybinding(["j", "down"]),
		label: "Next item",
		description: "Move to the next runner item",
		zone: zones.runner
	},
	"runner.previousItem": {
		keybindings: keybinding(["k", "up"]),
		label: "Previous item",
		description: "Move to the previous runner item",
		zone: zones.runner
	}
} as const satisfies AppCommandBase)

/**
 * The IDs of the available commands
 * See {@link appCommands }
 */
export type AppCommandID = keyof typeof appCommandsBase
