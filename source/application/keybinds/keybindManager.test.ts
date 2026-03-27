import { describe, expect, it, mock } from "bun:test"
import { firstValueFrom, Subject, take, toArray } from "rxjs"
import { ZONE_DEFAULT } from "#/core/commands/appCommands"
import { keybinding } from "#/shared/library/keybinds"
import { createKeybindManager } from "./keybindManager"
import { KeybindTrie } from "./keybindsState"
import type { KeyEvent } from "@opentui/core"
import type { KeybindZone } from "#/core/commands/appCommands"
import type { AppState } from "#/core/state/types"
import type { KeyBinding } from "#/shared/library/keybinds"
import type { ResolvedCommand } from "./keybindManager"
import type { KeyTypeData } from "./keysStream"

function createTestDeps() {
	const appState$ = new Subject<AppState>()
	const keys$ = new Subject<KeyTypeData>()
	const keybindsState = new KeybindTrie()

	const manager = createKeybindManager({ appState$, keybindsState, keys$ })

	return { appState$, keys$, keybindsState, manager }
}

function pressKey(
	keys$: Subject<KeyTypeData>,
	key: string,
	modifiers?: { ctrl?: boolean; shift?: boolean; option?: boolean }
): void {
	keys$.next({
		type: "keypress",
		event: {
			name: key,
			ctrl: modifiers?.ctrl ?? false,
			shift: modifiers?.shift ?? false,
			option: modifiers?.option ?? false,
			meta: false,
			sequence: key,
			number: false,
			raw: key,
			eventType: "press",
			source: "raw"
		} as KeyEvent
	})
}

function emitState(
	appState$: Subject<AppState>,
	overrides?: Partial<AppState>
): void {
	appState$.next({
		playback: {
			queue: undefined,
			manuallyAdded: [],
			index: 0,
			playState: "stopped",
			loopState: "none",
			shuffleMap: undefined,
			isPlayingFromManualQueue: false
		},
		view: { historyIndex: 0, history: [{ route: "home" }] },
		notifications: [],
		modals: [],
		inputsCaptured: [],
		activeZones: [],
		...overrides
	})
}

function makeResolvedCommand(
	label: string,
	keybindings: readonly KeyBinding[],
	callback: () => void
): ResolvedCommand {
	return { label, keybindings, callback }
}

describe("createKeybindManager", () => {
	describe("registerKeybinds and handleKeybinds", () => {
		it("should fire callback when registered key is pressed", () => {
			// TODO this is too much boilerplate per test. Merge "handleKeybinds"
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			manager.registerKeybinds([
				makeResolvedCommand("down", keybinding("j"), callback)
			])

			//todo wrap and use the "using" keyword to auto-cleanup
			const cleanup = manager.handleKeybinds()
			emitState(appState$)
			pressKey(keys$, "j")

			expect(callback).toHaveBeenCalledTimes(1)

			cleanup()
		})

		it("should not fire callback for unregistered keys", () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			manager.registerKeybinds([
				makeResolvedCommand("down", keybinding("j"), callback)
			])

			const cleanup = manager.handleKeybinds()
			emitState(appState$)
			pressKey(keys$, "k")

			expect(callback, "should not fire for 'k'").toHaveBeenCalledTimes(0)

			cleanup()
		})

		it("should emit unhandled keys for non-matching presses", async () => {
			const { manager, keys$, appState$ } = createTestDeps()

			const cleanup = manager.handleKeybinds()
			const unhandledPromise = firstValueFrom(manager.unhandled$)

			emitState(appState$)
			pressKey(keys$, "x")

			const unhandled = await unhandledPromise
			expect(unhandled.key, "should emit the unhandled key").toBe("x")

			cleanup()
		})

		it("should cleanup registrations when unregister function is called", () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			const unregister = manager.registerKeybinds([
				makeResolvedCommand("down", keybinding("j"), callback)
			])

			const cleanup = manager.handleKeybinds()
			emitState(appState$)

			unregister()
			pressKey(keys$, "j")

			expect(
				callback,
				"should not fire after unregister"
			).toHaveBeenCalledTimes(0)

			cleanup()
		})
	})

	describe("zone matching", () => {
		it("should fire commands whose zone is a prefix of the active zone", () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			manager.registerKeybinds(
				[makeResolvedCommand("select", keybinding("j"), callback)],
				{ zone: "queue" as KeybindZone }
			)

			const cleanup = manager.handleKeybinds()
			emitState(appState$, {
				activeZones: [{ zone: "queue.list" as KeybindZone, id: "1" }]
			})
			pressKey(keys$, "j")

			expect(
				callback,
				"should fire for zone prefix match"
			).toHaveBeenCalledTimes(1)

			cleanup()
		})

		it("should not fire commands from a non-matching zone", async () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			manager.registerKeybinds(
				[makeResolvedCommand("select", keybinding("j"), callback)],
				{ zone: "settings" as KeybindZone }
			)

			const cleanup = manager.handleKeybinds()
			const unhandledPromise = firstValueFrom(manager.unhandled$)

			emitState(appState$, {
				activeZones: [{ zone: "queue.list" as KeybindZone, id: "1" }]
			})
			pressKey(keys$, "j")

			const unhandled = await unhandledPromise
			expect(
				callback,
				"should not fire for non-matching zone"
			).toHaveBeenCalledTimes(0)
			expect(unhandled.key).toBe("j")

			cleanup()
		})

		it("should prefer the most specific zone when multiple match", () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callbackGeneral = mock(() => {})
			const callbackSpecific = mock(() => {})

			manager.registerKeybinds(
				[makeResolvedCommand("general", keybinding("j"), callbackGeneral)],
				{ zone: "queue" as KeybindZone }
			)
			manager.registerKeybinds(
				[makeResolvedCommand("specific", keybinding("j"), callbackSpecific)],
				{ zone: "queue.list" as KeybindZone }
			)

			const cleanup = manager.handleKeybinds()
			emitState(appState$, {
				activeZones: [{ zone: "queue.list" as KeybindZone, id: "1" }]
			})
			pressKey(keys$, "j")

			expect(
				callbackSpecific,
				"specific zone should fire"
			).toHaveBeenCalledTimes(1)
			expect(
				callbackGeneral,
				"general zone should not fire"
			).toHaveBeenCalledTimes(0)

			cleanup()
		})
	})

	describe("input capture filtering", () => {
		it("should suppress keybinds when input is captured", () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			manager.registerKeybinds([
				makeResolvedCommand("down", keybinding("j"), callback)
			])

			const cleanup = manager.handleKeybinds()
			emitState(appState$, { inputsCaptured: ["search"] })
			pressKey(keys$, "j")

			expect(
				callback,
				"should not fire when input captured"
			).toHaveBeenCalledTimes(0)

			cleanup()
		})

		it("should allow commands with allowDuringInput when input is captured", () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			manager.registerKeybinds(
				[makeResolvedCommand("escape", keybinding("esc"), callback)],
				{ zone: ZONE_DEFAULT, allowDuringInput: true }
			)

			const cleanup = manager.handleKeybinds()
			emitState(appState$, { inputsCaptured: ["search"] })
			pressKey(keys$, "esc")

			expect(callback, "allowDuringInput should fire").toHaveBeenCalledTimes(1)

			cleanup()
		})
	})

	describe("multi-key sequences", () => {
		it("should build up a sequence and fire on completion", () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			manager.registerKeybinds([
				makeResolvedCommand("go-top", keybinding("g g"), callback)
			])

			const cleanup = manager.handleKeybinds()
			emitState(appState$)

			pressKey(keys$, "g")
			const sequenceAfterFirst = manager.sequence$.getValue()
			expect(
				sequenceAfterFirst,
				"should have partial sequence after first key"
			).toBeDefined()
			expect(
				sequenceAfterFirst!.pressed,
				"pressed should contain first key"
			).toHaveLength(1)
			expect(callback, "should not fire after first key").toHaveBeenCalledTimes(
				0
			)

			pressKey(keys$, "g")
			expect(callback, "should fire after full sequence").toHaveBeenCalledTimes(
				1
			)

			cleanup()
		})

		it("should reset sequence on non-matching second key", () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			manager.registerKeybinds([
				makeResolvedCommand("go-top", keybinding("g g"), callback)
			])

			const cleanup = manager.handleKeybinds()
			emitState(appState$)

			pressKey(keys$, "g")
			pressKey(keys$, "x")

			expect(
				callback,
				"should not fire on non-matching second key"
			).toHaveBeenCalledTimes(0)

			cleanup()
		})
	})

	describe("disableCommand", () => {
		it("should prevent disabled commands from firing", () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			manager.registerKeybinds([
				{
					label: "next",
					keybindings: keybinding("l"),
					callback,
					commandId: "player.next"
				}
			])

			const cleanup = manager.handleKeybinds()
			emitState(appState$)

			manager.disableCommand("player.next")
			pressKey(keys$, "l")

			expect(
				callback,
				"disabled command should not fire"
			).toHaveBeenCalledTimes(0)

			cleanup()
		})

		it("should re-enable when the returned function is called", () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			manager.registerKeybinds([
				{
					label: "next",
					keybindings: keybinding("l"),
					callback,
					commandId: "player.next"
				}
			])

			const cleanup = manager.handleKeybinds()
			emitState(appState$)

			const enable = manager.disableCommand("player.next")
			enable()
			pressKey(keys$, "l")

			expect(callback, "re-enabled command should fire").toHaveBeenCalledTimes(
				1
			)

			cleanup()
		})
	})

	describe("key normalization", () => {
		it("should convert shift+letter to uppercase key without shift modifier", () => {
			const { manager, keys$, appState$ } = createTestDeps()
			const callback = mock(() => {})

			manager.registerKeybinds([
				makeResolvedCommand("go-bottom", keybinding("G"), callback)
			])

			const cleanup = manager.handleKeybinds()
			emitState(appState$)
			pressKey(keys$, "g", { shift: true })

			expect(
				callback,
				"shift+g should match 'G' binding"
			).toHaveBeenCalledTimes(1)

			cleanup()
		})
	})
})
