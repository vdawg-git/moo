import type { AppCommandID } from "#/commands/commandsBase"

export type PlayingState = "playing" | "paused" | "stopped"
export type LoopState = "none" | "loop_queue" | "loop_track"

/** A branded type for a file/directory path. Just a string. */
export type FilePath = string & { __brand: "FilePath" }

export type ErrorNotificationFn = (
	message: string,
	error?: unknown,
	tag?: string
) => void

export type CommandCallbackGetterFn = (id: AppCommandID) => () => void
