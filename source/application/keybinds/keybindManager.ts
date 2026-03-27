import { isNonNullish, isTruthy } from "remeda"
import {
	distinctUntilChanged,
	filter,
	map,
	merge,
	scan,
	share,
	shareReplay,
	skipUntil,
	startWith,
	switchMap,
	timer,
	withLatestFrom
} from "rxjs"
import { match, P } from "ts-pattern"
import { ZONE_DEFAULT } from "#/core/commands/appCommands"
import { getActiveZone } from "#/core/state/stateUtils"
import { callAll } from "#/shared/helpers"
import { toReadonlyBehaviorSubject } from "#/shared/library/readonlyBehaviorSubject"
import { logger } from "#/shared/logs"
import type { KeyEvent } from "@opentui/core"
import type { AppCommandsMap } from "#/core/commands/appCommands"
import type { AppCommandID } from "#/core/commands/definitions"
import type { AppState } from "#/core/state/types"
import type { KeyBinding, KeyInput } from "#/shared/library/keybinds"
import type { ReadonlyBehaviorSubject } from "#/shared/library/readonlyBehaviorSubject"
import type { Observable } from "rxjs"
import type {
	KeybindCommand,
	KeybindCommandMap,
	KeybindNextUp,
	KeybindZone
} from "./keybindsState"
import type { KeyPressEvent, KeyTypeData } from "./keysStream"

type KeybindingOutcome =
	| { type: "callbacks"; callbacks: readonly KeybindCommand["callback"][] }
	| { type: "sequence"; sequence: KeySequence }
	| { type: "unhandled"; key: KeyInput }

export type KeySequence = {
	pressed: KeyBinding
	nextUp: readonly KeybindNextUp[]
}

export type KeybindManagerDeps = {
	readonly appState$: Observable<AppState>
	readonly keybindsState: KeybindsTrie
	readonly keys$: Observable<KeyTypeData>
}

/** Subset of KeybindTrie that the manager needs */
type KeybindsTrie = {
	readonly getCommandsForKeys: (
		sequence: KeyBinding
	) => readonly KeybindCommand[]
	readonly getNextUp: (sequence: KeyBinding) => readonly KeybindNextUp[]
	readonly addSequence: (sequence: KeyBinding, command: KeybindCommand) => void
	readonly removeSequence: (sequence: KeyBinding, id: string) => void
	readonly getAllCommands: () => KeybindCommandMap
}

export type KeybindManager = {
	readonly handleKeybinds: () => () => void
	readonly registerKeybinds: (
		toRegister: readonly ResolvedCommand[],
		options?: { zone: KeybindZone; allowDuringInput?: boolean }
	) => () => void
	/** Temporarily disables a configured command by ID. Returns an enable function. */
	readonly disableCommand: (commandId: AppCommandID) => () => void
	readonly unhandled$: Observable<KeyInput>
	readonly sequence$: ReadonlyBehaviorSubject<KeySequence | undefined>
	readonly getAllCommands: () => KeybindCommandMap
}

/** Creates a keybind manager with injected dependencies */
export function createKeybindManager({
	appState$,
	keybindsState,
	keys$
}: KeybindManagerDeps): KeybindManager {
	let nextInlineId = 0
	const disabledCommands = new Set<AppCommandID>()

	const isInputCaptured$: Observable<boolean> = appState$.pipe(
		map((state) => state.inputsCaptured.length > 0),
		startWith(false),
		distinctUntilChanged(),
		shareReplay({ refCount: false, bufferSize: 1 })
	)

	const activeZone$: Observable<KeybindZone> = appState$.pipe(
		map((state) => getActiveZone(state.activeZones)),
		startWith(ZONE_DEFAULT as KeybindZone),
		distinctUntilChanged(),
		shareReplay({ refCount: false, bufferSize: 1 })
	)

	const pressed$: Observable<KeyPressEvent> = keys$.pipe(
		filter((event): event is KeyPressEvent => event.type === "keypress")
	)

	const keySequenceResult$: Observable<KeybindingOutcome | undefined> =
		pressed$.pipe(
			withLatestFrom(isInputCaptured$),
			map(([keypress, inputCaptured]) => ({
				keyInput: openTuiInputToKeyInput(keypress.event),
				inputCaptured
			})),
			withLatestFrom(activeZone$),
			switchMap(([{ keyInput, inputCaptured }, zone]) => {
				const sequenceReset$ = merge(
					activeZone$.pipe(skipUntil(timer(0)), distinctUntilChanged()),
					isInputCaptured$.pipe(skipUntil(timer(0)), distinctUntilChanged())
				).pipe(map(() => ({ input: undefined, zone, inputCaptured: false })))

				return sequenceReset$.pipe(
					startWith({ input: keyInput, zone, inputCaptured })
				)
			}),
			scan(
				(previous, current) =>
					reduceToCommandAndSequences(
						keybindsState,
						disabledCommands,
						previous,
						current
					),
				undefined as KeybindingOutcome | undefined
			),
			distinctUntilChanged(),
			share()
		)

	function handleKeybinds() {
		const subscription = keySequenceResult$.subscribe((inputResult) => {
			if (inputResult?.type !== "callbacks") return

			callAll(inputResult.callbacks)
		})

		return () => subscription.unsubscribe()
	}

	function registerKeybinds(
		toRegister: readonly ResolvedCommand[],
		options?: { zone: KeybindZone; allowDuringInput?: boolean }
	) {
		const registrations: { id: string; keybindings: readonly KeyBinding[] }[] =
			[]

		toRegister.forEach(({ keybindings, label, callback, commandId }) => {
			const id = commandId ?? `inline_${nextInlineId++}_${label}`
			registrations.push({ id, keybindings })

			keybindings.forEach((sequence) => {
				keybindsState.addSequence(sequence, {
					callback,
					id,
					commandId,
					label,
					zone: options?.zone ?? ZONE_DEFAULT,
					allowDuringInput: options?.allowDuringInput
				})
			})
		})

		return () => {
			registrations.forEach(({ id, keybindings }) =>
				keybindings.forEach((sequence) =>
					keybindsState.removeSequence(sequence, id)
				)
			)
		}
	}

	function disableCommand(commandId: AppCommandID): () => void {
		disabledCommands.add(commandId)

		return () => {
			disabledCommands.delete(commandId)
		}
	}

	const unhandled$ = keySequenceResult$.pipe(
		map((outcome) => (outcome?.type === "unhandled" ? outcome.key : undefined)),
		filter(isNonNullish),
		share()
	)

	const sequence$ = toReadonlyBehaviorSubject(
		keySequenceResult$.pipe(
			map((outcome) =>
				outcome?.type === "sequence" ? outcome.sequence : undefined
			),
			share()
		),
		undefined
	).subject

	return {
		handleKeybinds,
		registerKeybinds,
		disableCommand,
		unhandled$,
		sequence$,
		getAllCommands: () => keybindsState.getAllCommands()
	}
}

/** Returns true if `commandZone` is a prefix of (or equal to) `activeZone` */
function zoneMatches(commandZone: string, activeZone: string): boolean {
	if (commandZone === activeZone) return true

	return activeZone.startsWith(commandZone + ".")
}

/**
 * Filters commands by zone match and input-captured state.
 * When inputCaptured is true, only commands with `allowDuringInput` pass.
 * Among matching commands, the most specific zone wins (longest zone string).
 */
function filterCommandsByZone(
	commands: readonly KeybindCommand[],
	activeZone: string,
	inputCaptured: boolean,
	disabled: ReadonlySet<AppCommandID>
): readonly (() => void)[] {
	const matching = commands.filter(
		(command) =>
			zoneMatches(command.zone, activeZone)
			&& (!inputCaptured || command.allowDuringInput)
			&& !(command.commandId && disabled.has(command.commandId))
	)

	if (matching.length === 0) return []

	// Specificity: only fire the most specific zone
	const maxSpecificity = Math.max(...matching.map(({ zone }) => zone.length))

	return matching
		.filter((c) => c.zone.length === maxSpecificity)
		.map((c) => c.callback)
}

function reduceToCommandAndSequences(
	keybindsState: KeybindsTrie,
	disabled: ReadonlySet<AppCommandID>,
	previous: KeybindingOutcome | undefined,
	{
		input,
		zone,
		inputCaptured
	}: {
		zone: KeybindZone
		input: KeyInput | undefined
		inputCaptured: boolean
	}
): KeybindingOutcome | undefined {
	// Input gets set to undefined if it is disabled
	if (input === undefined) return undefined

	return (
		match(previous)
			.returnType<KeybindingOutcome | undefined>()

			// If "callbacks" are returned, those will be called.
			// The next scan will receive those, but that just means that
			// the reducer should start from scratch again as the previous sequence completed
			.with(
				P.union({ type: P.union("callbacks", "unhandled") }, undefined),
				() => {
					const callbacks = filterCommandsByZone(
						keybindsState.getCommandsForKeys([input]),
						zone,
						inputCaptured,
						disabled
					)

					if (callbacks.length > 0) return { type: "callbacks", callbacks }

					const nextUp = keybindsState
						.getNextUp([input])
						.filter(
							({ command }) =>
								zoneMatches(command.zone, zone)
								&& (!inputCaptured || command.allowDuringInput)
								&& !(command.commandId && disabled.has(command.commandId))
						)

					return nextUp.length > 0
						? ({
								type: "sequence",
								sequence: { pressed: [input], nextUp }
							} satisfies KeybindingOutcome)
						: { type: "unhandled", key: input }
				}
			)

			.with(
				{ type: "sequence" },
				({ sequence: { pressed: previousPressed } }) => {
					const pressed = [...previousPressed, input]
					const callbacks = filterCommandsByZone(
						keybindsState.getCommandsForKeys(pressed),
						zone,
						inputCaptured,
						disabled
					)

					if (callbacks.length > 0) {
						return { type: "callbacks", callbacks } as const
					}

					const nextUp = keybindsState
						.getNextUp(pressed)
						.filter(
							({ command }) =>
								zoneMatches(command.zone, zone)
								&& (!inputCaptured || command.allowDuringInput)
								&& !(command.commandId && disabled.has(command.commandId))
						)

					if (nextUp.length > 0) {
						return {
							type: "sequence",
							sequence: { pressed, nextUp }
						} as const satisfies KeybindingOutcome
					}

					return undefined
				}
			)
			.exhaustive()
	)
}

const isLatinLetterRegex = /[a-z]/

function openTuiInputToKeyInput(event: KeyEvent): KeyInput {
	logger.debug("key event", { ...event })
	const { ctrl, option, shift, name } = event

	const shouldUppercase = shift && isLatinLetterRegex.test(name)
	const key = shouldUppercase ? name.toUpperCase() : name

	const modifiers: KeyInput["modifiers"] = [
		ctrl && ("ctrl" as const),
		option && ("alt" as const),
		shift && !shouldUppercase && ("shift" as const)
	].filter(isTruthy)

	return { key, modifiers }
}

/** Reference to a configured command — keybindings resolved from config */
export type CommandReference = {
	readonly commandId: AppCommandID
	readonly callback: () => void
}

/** Dynamic command with inline keybindings */
export type CommandInline = {
	readonly label: string
	readonly keybindings: readonly KeyBinding[]
	readonly callback: () => void
}

export type CommandArgument = CommandReference | CommandInline

/** Resolved command ready for registration — what `registerKeybinds` accepts */
export type ResolvedCommand = CommandInline & {
	/** Present when resolved from a {@link CommandReference} */
	readonly commandId?: AppCommandID
}

/** Resolves a {@link CommandReference} to a {@link ResolvedCommand} using the config */
export function resolveCommand(
	command: CommandArgument,
	config: AppCommandsMap
): ResolvedCommand | undefined {
	if (!("commandId" in command)) return command

	const data = config.get(command.commandId)
	if (!data) return undefined

	return {
		commandId: command.commandId,
		label: data.label,
		keybindings: data.keybindings,
		callback: command.callback
	}
}
