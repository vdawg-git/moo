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
import { LocalTrack } from "#/database/localTrack"
import { callAll } from "#/helpers"
import { logger } from "#/logs"
import { handleMpris } from "./mpris"
import type { AppCommand, AppCommandsMap } from "#/commands/appCommands"
import type { AppCommandID } from "#/commands/commandsBase"
import type { Track } from "#/database/types"
import type { KeybindManager } from "#/keybindManager/keybindManager"
import type { Player } from "#/player/types"
import type { AppStore } from "#/state/state"
import type { AppState } from "#/state/types"
import type {
	CommandCallbackGetterFn,
	ErrorNotificationFn
} from "#/types/types"
import type { Observable } from "rxjs"

export type AudioPlaybackDeps = {
	readonly appState: AppStore
	readonly appState$: Observable<AppState>
	readonly currentTrack$: Observable<LocalTrack | undefined>
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
	const toPlay$: Observable<Track | undefined> = combineLatest([
		deps.currentTrack$,
		deps.playState$
	]).pipe(
		map(([track, playState]) => (playState !== "playing" ? undefined : track)),
		distinctUntilChanged((previous, current) => previous?.id === current?.id),
		map((track) => track && new LocalTrack(track, deps.player))
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
		addErrorNotification
	}: Pick<AudioPlaybackDeps, "appState" | "addErrorNotification">,
	toPlay$: Observable<Track | undefined>
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
			switchMap((track) => track?.events$ ?? EMPTY),
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
			// Wether the source has changed and the current player should be cleared
			// Do not clear if previous or current is undefined, because this could just
			// mean that the playback got paused.
			const hasSourceChanged =
				previous
				&& current
				&& previous.sourceProvider !== current?.sourceProvider

			if (hasSourceChanged) {
				await previous
					?.clear()
					.onFailure((error) =>
						addErrorNotification("Failed to clear player", error)
					)
			}

			if (!current) {
				await previous
					?.pause()
					.onFailure((error) =>
						addErrorNotification("Failed to pause track", error)
					)

				return
			}

			await current
				.play()
				.onFailure((error) =>
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
