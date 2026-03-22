import {
	auditTime,
	combineLatest,
	distinctUntilChanged,
	EMPTY,
	map,
	pairwise,
	startWith,
	Subject,
	switchMap,
	tap
} from "rxjs"
import { match } from "ts-pattern"
import { Result } from "typescript-result"
import { callAll } from "#/shared/helpers"
import { logger } from "#/shared/logs"
import { handleMpris } from "./mpris"
import type { KeybindManager } from "#/application/keybinds/keybindManager"
import type { AppCommand, AppCommandsMap } from "#/core/commands/appCommands"
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
}): readonly AppCommand[] {
	const ids: readonly AppCommandID[] = [
		"player.togglePlayback",
		"player.next",
		"player.playPrevious"
	]

	return ids.map((id) => ({
		id,
		...keybindings.get(id)!,
		callback: getCommandCallback(id)
	}))
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

	const subscription = appState$
		.pipe(
			map((state) => !!state.playback.queue),
			distinctUntilChanged()
		)
		.subscribe((hasQueue) => {
			if (hasQueue) {
				keybindManager.registerKeybinds(playbackCommands)
			} else {
				keybindManager.unregisterKeybinds(playbackCommands)
			}
		})

	return () => subscription.unsubscribe()
}

function handlePlayer(
	{
		appState,
		player,
		addErrorNotification
	}: Pick<AudioPlaybackDeps, "appState" | "player" | "addErrorNotification">,
	toPlay$: Observable<BaseTrack | undefined>
) {
	/**
	 * Progress has its own stream,
	 * so that we are able to throttle it here,
	 * without Players having to worry about that.
	 */
	const progressInput$ = new Subject<number>()
	const progressSubscription = progressInput$
		.pipe(auditTime(250))
		.subscribe((newTime) => {
			appState.send({ type: "setPlayProgress", newTime })
		})

	const playEventsSubscription = toPlay$
		.pipe(
			switchMap((track) => (track ? player.events$ : EMPTY)),
			tap((playEvent) => logger.debug("playevent", { playEvent }))
		)
		.subscribe((event) =>
			match(event)
				.with({ type: "finishedTrack" }, () =>
					appState.send({ type: "nextTrack" })
				)

				.with({ type: "error" }, (error) => {
					addErrorNotification("Error when playing back", error)
				})

				.with({ type: "progress" }, ({ currentTime }) => {
					progressInput$.next(currentTime)
				})
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
		[playSubscription, playEventsSubscription, progressSubscription].forEach(
			(subscription) => subscription.unsubscribe()
		)
}
