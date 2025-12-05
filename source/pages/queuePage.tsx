import { Result } from "typescript-result"
import { List, type ListItem, useList } from "#/components/list"
import { Playbar } from "#/components/playbar"
import { PlaylistTitle } from "#/components/playlilstTitle"
import { TrackItem } from "#/components/tracklist"
import { database } from "#/database/database"
import { type QueryResult, useQuery } from "#/database/useQuery"
import { useColors } from "#/hooks/useColors"
import { registerKeybinds } from "#/keybindManager/keybindManager"
import { keybinding } from "#/lib/keybinds"
import { appState } from "#/state/state"
import { usePlaybackData } from "#/state/useSelectors"
import type { BaseTrack } from "#/database/types"
import type { AppState } from "#/state/types"

export function QueuePage() {
	const playbackState = usePlaybackData()
	const { queue, manuallyAdded: manuallyAddedIds } = playbackState
	const autoTrackIds = queue?.tracks ?? []

	const ids = [...(queue?.tracks ?? []), ...manuallyAddedIds]
	const totalTracks = queue?.tracks.length ?? 0 + manuallyAddedIds.length

	const response: QueryResult<{
		autoAdded: readonly BaseTrack[]
		manualAdded: readonly BaseTrack[]
	}> = useQuery(["tracks", ...new Set(ids)], () =>
		Result.fromAsyncCatching(database.getTracks(ids)).map((tracks) => {
			return {
				autoAdded:
					autoTrackIds.flatMap(
						(id) => tracks.find(({ id: trackId }) => id === trackId) ?? []
					) ?? [],
				manualAdded: manuallyAddedIds.flatMap(
					(id) => tracks.find(({ id: trackId }) => trackId === id) ?? []
				)
			}
		})
	)

	const colors = useColors()

	return (
		<>
			<box flexGrow={1} flexDirection="column">
				<PlaylistTitle title={"Queue"} tracksAmount={totalTracks} />

				{response.isLoading ? (
					<text>Loading...</text>
				) : (
					response.data.fold(
						({ autoAdded, manualAdded }) => (
							<QueueView
								autoAdded={autoAdded}
								manuallyAdded={manualAdded}
								isPlayingFromManualQueue={
									playbackState.isPlayingFromManualQueue
								}
								playIndex={playbackState.index}
								playState={playbackState.playState}
							/>
						),
						(error) => <text fg={colors.red}>Error: {String(error)}</text>
					)
				)}
			</box>

			<Playbar />
		</>
	)
}

type QueueViewProps = {
	manuallyAdded: readonly BaseTrack[]
	autoAdded: readonly BaseTrack[]
	playIndex: number
	isPlayingFromManualQueue: boolean
	playState: AppState["playback"]["playState"]
}

function QueueView({
	autoAdded,
	isPlayingFromManualQueue,
	manuallyAdded,
	playIndex,
	playState
}: QueueViewProps) {
	const colors = useColors()

	const manual: readonly ListItem<BaseTrack>[] = manuallyAdded.map((track) => ({
		data: track,
		onSelect: ({ itemIndex }) =>
			appState.send({ type: "playFromManualQueue", index: itemIndex }),
		onFocus: ({ itemIndex }) =>
			registerManualQueueCommands(itemIndex, "manual_" + itemIndex + track.id),
		render: ({ itemIndex, focused }) => (
			<TrackItem
				track={track}
				focused={focused}
				state={
					isPlayingFromManualQueue && itemIndex === 0
						? playState === "playing"
							? "playing"
							: playState === "paused"
								? "paused"
								: undefined
						: undefined
				}
				color={colors.green}
			/>
		)
	}))

	const auto: readonly ListItem<BaseTrack>[] = autoAdded
		.slice(playIndex)
		.map((track) => ({
			data: track,
			onSelect: ({ itemIndex }) =>
				appState.send({ type: "playIndex", index: playIndex + itemIndex + 1 }),
			onFocus: ({ itemIndex }) =>
				registerAutoQueueCommands(
					itemIndex,
					"auto_queue_" + itemIndex + track.id
				),
			render: ({ itemIndex, focused }) => (
				<TrackItem
					track={track}
					focused={focused}
					state={
						isPlayingFromManualQueue
							? undefined
							: itemIndex === 0
								? playState === "playing"
									? "playing"
									: playState === "paused"
										? "paused"
										: undefined
								: undefined
					}
				/>
			)
		}))

	const items: readonly ListItem<BaseTrack>[] = [...manual, ...auto]
	const isEmpty = items.length === 0

	const useListReturn = useList({
		items
	})

	if (isEmpty) {
		return <text>Queue is empty. Start playing a playlist</text>
	}

	return <List flexDirection="column" register={useListReturn} />
}

function registerManualQueueCommands(index: number, uid: string): () => void {
	return registerKeybinds([
		{
			label: "Remove from queue",
			callback: () => appState.send({ type: "removeFromManualQueue", index }),
			keybindings: keybinding("d"),
			id: uid
		}
	])
}

function registerAutoQueueCommands(index: number, uid: string): () => void {
	return registerKeybinds([
		{
			label: "Remove from queue",
			callback: () => appState.send({ type: "removeFromQueue", index }),
			keybindings: keybinding("d"),
			id: uid
		}
	])
}
