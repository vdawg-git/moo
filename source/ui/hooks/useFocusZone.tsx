import { useEffect, useRef, useState } from "react"
import { useAppContext } from "#/app/context"
import { useKeybindings } from "#/application/keybinds/useKeybindings"
import { keybinding } from "#/shared/library/keybinds"
import type {
	CommandArgument,
	CommandInline,
	CommandReference
} from "#/application/keybinds/keybindManager"
import type { AppCommandID } from "#/core/commands/definitions"
import type { KeyInput } from "#/shared/library/keybinds"

export type ArrowDirection = "up" | "down" | "left" | "right"

export type ZoneCallbackApi<T extends string> = {
	readonly setZone: (name: T) => void
}

export type ZoneDefinition<
	TName extends string = string,
	TCommands extends AppCommandID = AppCommandID
> = {
	readonly name: TName
	/** Runtime callbacks per command ID — keybindings are derived from the config */
	readonly callbacks: Readonly<
		Partial<Record<TCommands, (api: ZoneCallbackApi<TName>) => void>>
	>
	/** Dynamic commands (non-configurable, registered at runtime) */
	readonly commands?: readonly CommandInline[]
	/** Zone contains a text input — enables inputCaptured mode */
	readonly isInput?: boolean
	/** Arrow directions used for in-zone navigation (these block zone switching) */
	readonly arrows?: readonly ArrowDirection[]
	/** Spatial neighbors for arrow-key zone switching */
	readonly neighbors?: Readonly<Partial<Record<ArrowDirection, TName>>>
}

export type UseFocusZoneOptions<TName extends string> = {
	readonly zones: readonly ZoneDefinition<TName>[]
	readonly initialZone?: NoInfer<TName>
	/** Fires when a key press matches no command in the active zone */
	readonly onUnmatchedKey?: (key: KeyInput) => void
}

export type UseFocusZoneReturn<T extends string> = {
	readonly activeZoneIndex: number
	readonly activeZoneName: T
	readonly setZone: (name: T) => void
	readonly isActive: (name: T) => boolean
}

// Pure state logic — testable without React

export type FocusZoneState = {
	readonly activeIndex: number
	readonly zoneCount: number
}

export function createFocusZoneState(options: {
	zoneCount: number
	initialZone?: number
}): {
	getState: () => FocusZoneState
	goNext: () => FocusZoneState
	goPrevious: () => FocusZoneState
	setZone: (index: number) => FocusZoneState
	goToZone: (zoneNumber: number) => FocusZoneState
} {
	let state: FocusZoneState = {
		activeIndex: options.initialZone ?? 0,
		zoneCount: options.zoneCount
	}

	const goNext = (): FocusZoneState => {
		const next = (state.activeIndex + 1) % state.zoneCount
		state = { ...state, activeIndex: next }

		return Object.freeze(state)
	}

	const goPrevious = (): FocusZoneState => {
		const previous = (state.activeIndex - 1 + state.zoneCount) % state.zoneCount
		state = { ...state, activeIndex: previous }

		return Object.freeze(state)
	}

	const setZone = (index: number): FocusZoneState => {
		state = { ...state, activeIndex: index }

		return Object.freeze(state)
	}

	const goToZone = (zoneNumber: number): FocusZoneState => {
		if (zoneNumber >= 1 && zoneNumber <= state.zoneCount) {
			state = { ...state, activeIndex: zoneNumber - 1 }
		}

		return Object.freeze(state)
	}

	return {
		getState: () => state,
		goNext,
		goPrevious,
		setZone,
		goToZone
	}
}

/** Builds zone-specific commands from callbacks, passing `api` to each callback */
function buildZoneCommands<T extends string>(
	zone: ZoneDefinition<T>,
	api: ZoneCallbackApi<T>
): readonly CommandArgument[] {
	const commandIds = Object.keys(zone.callbacks) as AppCommandID[]

	const fromCallbacks: readonly CommandReference[] = commandIds.flatMap(
		(commandId) => {
			const callbackWithApi =
				zone.callbacks[commandId as keyof typeof zone.callbacks]
			if (!callbackWithApi) return []

			return [{ commandId, callback: () => callbackWithApi(api) }]
		}
	)

	return [...fromCallbacks, ...(zone.commands ?? [])]
}

/** Builds hardcoded arrow-key commands for zone switching based on neighbors config */
function buildArrowNeighborCommands<T extends string>({
	zone,
	zones,
	onSwitch
}: {
	zone: ZoneDefinition<T>
	zones: readonly ZoneDefinition<T>[]
	onSwitch: (targetIndex: number) => void
}): readonly CommandInline[] {
	const { neighbors, arrows } = zone
	if (!neighbors) return []

	const claimedDirections = new Set(arrows ?? [])

	return Object.entries(neighbors).flatMap(([direction, targetName]) => {
		if (!targetName) return []
		if (claimedDirections.has(direction as ArrowDirection)) return []

		const targetIndex = zones.findIndex((z) => z.name === targetName)
		if (targetIndex === -1) return []

		return [
			{
				label: `Go to ${targetName}`,
				keybindings: keybinding(direction),
				callback: () => onSwitch(targetIndex)
			}
		]
	})
}

/**
 * Manages focused zones within a page. Replaces `useFocusItems` + `useKeyboard` patterns.
 *
 * Each zone gets its own keybinding context. Tab/Shift-Tab cycles between zones.
 * Number keys (1-N) jump to zones directly.
 */
export function useFocusZones<T extends string>({
	zones,
	initialZone,
	onUnmatchedKey
}: UseFocusZoneOptions<T>): UseFocusZoneReturn<T> {
	const { keybindManager } = useAppContext()

	const stateRef = useRef(
		null as unknown as ReturnType<typeof createFocusZoneState>
	)
	if (!stateRef.current) {
		stateRef.current = createFocusZoneState({
			zoneCount: zones.length,
			initialZone: zones.findIndex((zone) => zone.name === initialZone)
		})
	}

	const [activeIndex, setActiveIndex] = useState(
		stateRef.current.getState().activeIndex
	)
	const activeZone = zones[activeIndex]!

	const setZoneByName = (name: T) => {
		const zoneIndex = zones.findIndex((zone) => zone.name === name)
		if (zoneIndex === -1)
			throw new Error(`Zone with name "${name}" could not be found #osfg%`)

		const state = stateRef.current.setZone(zoneIndex)
		setActiveIndex(state.activeIndex)
	}

	const callbackApi: ZoneCallbackApi<T> = { setZone: setZoneByName }

	// Zone cycling: Tab and Shift+Tab
	useKeybindings(
		() => [
			{
				label: "Next zone",
				keybindings: keybinding("tab"),
				callback: () => {
					const state = stateRef.current.goNext()
					setActiveIndex(state.activeIndex)
				}
			},
			{
				label: "Previous zone",
				keybindings: keybinding("shift+tab"),
				callback: () => {
					const state = stateRef.current.goPrevious()
					setActiveIndex(state.activeIndex)
				}
			}
		],
		{ allowDuringInput: true }
	)

	// Number keys to jump to zones (1-9)
	useKeybindings(
		() =>
			zones.slice(0, 9).map((zone, index) => ({
				label: `Go to ${zone.name}`,
				keybindings: keybinding(String(index + 1)),
				callback: () => {
					const state = stateRef.current.goToZone(index + 1)
					setActiveIndex(state.activeIndex)
				}
			})),
		{ enabled: !activeZone.isInput }
	)

	// Register keybindings for each zone
	for (const [index, zone] of zones.entries()) {
		const isActive = index === activeIndex
		const allCommands = buildZoneCommands(zone, callbackApi)

		const isAbort = (command: CommandArgument): boolean =>
			"commandId" in command && command.commandId === "abort"

		const abortCommands = allCommands.filter(isAbort)
		const regularCommands = allCommands.filter((c) => !isAbort(c))

		// eslint-disable-next-line react-hooks/rules-of-hooks
		useKeybindings(() => regularCommands, { enabled: isActive })

		// Abort registered separately so escape works even when input is captured
		// eslint-disable-next-line react-hooks/rules-of-hooks
		useKeybindings(() => abortCommands, {
			enabled: isActive,
			allowDuringInput: true
		})

		// Arrow-key zone switching: directions NOT claimed by arrows navigate to neighbors
		const arrowCommands = buildArrowNeighborCommands({
			zone,
			zones,
			onSwitch: (targetIndex) => {
				const state = stateRef.current.setZone(targetIndex)
				setActiveIndex(state.activeIndex)
			}
		})

		useKeybindings(() => arrowCommands, {
			enabled: isActive,
			allowDuringInput: true
		})
	}

	// Handle unmatched keys via keySequenceResult$
	useEffect(() => {
		if (!onUnmatchedKey) return

		const subscription = keybindManager.unhandled$.subscribe((key) => {
			onUnmatchedKey(key)
		})

		return () => subscription.unsubscribe()
	}, [keybindManager.unhandled$, onUnmatchedKey])

	return {
		activeZoneIndex: activeIndex,
		activeZoneName: activeZone.name,
		setZone: setZoneByName,
		isActive: (name: string) => activeZone.name === name
	}
}
