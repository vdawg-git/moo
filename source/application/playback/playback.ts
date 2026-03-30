import {
	combineLatest,
	distinctUntilChanged,
	EMPTY,
	map,
	pairwise,
	startWith,
	switchMap,
	tap
} from "rxjs"
import { match } from "ts-pattern"
import { Result } from "typescript-result"
import { getCurrentTrack } from "#/core/state/stateUtils"
import { callAll } from "#/shared/helpers"
import { logger } from "#/shared/logs"
import { handleMpris } from "./mpris"
import type {
	KeybindManager,
	ResolvedCommand
} from "#/application/keybinds/keybindManager"
import type { AppCommandsMap } from "#/core/commands/appCommands"
import type { AppCommandID } from "#/core/commands/definitions"
import type { AppStore } from "#/core/state/state"
import type { AppState } from "#/core/state/types"
import type { BaseTrack } from "#/ports/database"
import type { Player } from "#/ports/player"
import type {
	CommandCallbackGetterFn,
	ErrorNotificationFn
} from "#/shared/types/types"
import type { Observable } from "rxjs"

export type AudioPlaybackDeps = {
	readonly appState: AppStore
	readonly appState$: Observable<AppState>
	readonly currentTrack$: Observable<BaseTrack | undefined>
	readonly playState$: Observable<AppState["playback"]["playState"]>
	readonly loop$: Observable<AppState["playback"]["loopState"]>
	readonly player: Player
	readonly addErrorNotification: ErrorNotificationFn
	readonly keybindManager: KeybindManager
	readonly getCommandCallback: CommandCallbackGetterFn
	readonly keybindings: AppCommandsMap
}

/**
 * Listen to state changes and play the applicable track.
 *
 * Returns the subscription which can be unsubscribed from.
 */
export function handleAudioPlayback(deps: AudioPlaybackDeps) {
	const toPlay$: Observable<BaseTrack | undefined> = combineLatest([
		deps.currentTrack$,
		deps.playState$
	]).pipe(
		map(([track, playState]) => (playState !== "playing" ? undefined : track)),
		distinctUntilChanged((previous, current) => previous?.id === current?.id)
	)

	const unsubscribers = [
		handlePlayer(deps, toPlay$),
		registeringPlaybackCommands(deps),
		handleMpris({
			appState: deps.appState,
			currentTrack$: deps.currentTrack$,
			loop$: deps.loop$,
			playState$: deps.playState$
		})
	]

	return () => callAll(unsubscribers)
}

/** Builds playback command objects from keybindings + callbacks */
function buildPlaybackCommands({
	getCommandCallback,
	keybindings
}: {
	readonly getCommandCallback: CommandCallbackGetterFn
	readonly keybindings: AppCommandsMap
}): readonly ResolvedCommand[] {
	const ids: readonly AppCommandID[] = [
		"player.togglePlayback",
		"player.next",
		"player.playPrevious"
	]

	return ids.map((commandId) => {
		const data = keybindings.get(commandId)!

		return {
			commandId,
			label: data.label,
			keybindings: data.keybindings,
			callback: getCommandCallback(commandId)
		}
	})
}

/**  Registers playback commands reactively */
function registeringPlaybackCommands({
	appState$,
	keybindManager,
	getCommandCallback,
	keybindings
}: Pick<
	AudioPlaybackDeps,
	"appState$" | "keybindManager" | "getCommandCallback" | "keybindings"
>) {
	const playbackCommands = buildPlaybackCommands({
		getCommandCallback,
		keybindings
	})

	let cleanupKeybinds: (() => void) | undefined

	const subscription = appState$
		.pipe(
			map((state) => !!state.playback.queue),
			distinctUntilChanged()
		)
		.subscribe((hasQueue) => {
			cleanupKeybinds?.()
			cleanupKeybinds = undefined

			if (hasQueue) {
				cleanupKeybinds = keybindManager.registerKeybinds(playbackCommands)
			}
		})

	return () => {
		cleanupKeybinds?.()
		subscription.unsubscribe()
	}
}

function handlePlayer(
	{
		appState,
		player,
		addErrorNotification
	}: Pick<AudioPlaybackDeps, "appState" | "player" | "addErrorNotification">,
	toPlay$: Observable<BaseTrack | undefined>
) {
	const playEventsSubscription = toPlay$
		.pipe(
			switchMap((track) => (track ? player.events$ : EMPTY)),
			tap((playEvent) => logger.debug("playevent", { playEvent }))
		)
		.subscribe((event) =>
			match(event)
				.with({ type: "finishedTrack" }, ({ trackId: finishedId }) => {
					const playback = appState.getSnapshot().context.playback
					const currentTrackId = getCurrentTrack(playback)?.trackId

					if (finishedId !== currentTrackId) return

					if (playback.loopState === "loop_track") {
						Result.fromAsync(player.play(finishedId)).onFailure((error) =>
							addErrorNotification("Failed to replay track", error)
						)

						return
					}

					appState.send({ type: "nextTrack" })
				})

				.with({ type: "error" }, (error) => {
					addErrorNotification("Error when playing back", error)
				})

				.with({ type: "progress" }, () => {})
				.exhaustive()
		)

	const playSubscription = toPlay$
		.pipe(startWith(undefined), pairwise())
		.subscribe(async ([previous, current]) => {
			const hasSourceChanged = previous && current && previous.id !== current.id

			if (hasSourceChanged) {
				await Result.fromAsync(player.clear()).onFailure((error) =>
					addErrorNotification("Failed to clear player", error)
				)
			}

			if (!current) {
				if (previous) {
					await Result.fromAsync(player.pause(previous.id)).onFailure((error) =>
						addErrorNotification("Failed to pause track", error)
					)
				}

				return
			}

			await Result.fromAsync(player.play(current.id)).onFailure((error) =>
				addErrorNotification(
					`Failed to play track ${current.title ?? current.id}`,
					error,
					"Track playback failed"
				)
			)
		})

	return () =>
		[playSubscription, playEventsSubscription].forEach((subscription) =>
			subscription.unsubscribe()
		)
}
