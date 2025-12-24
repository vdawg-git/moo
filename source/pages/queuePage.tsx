import { Result } from "typescript-result"
import { List, useList } from "#/components/list"
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

type ListItemQueue = {
	type: "auto" | "manual"
	track: BaseTrack
	itemIndex: number
}

export function QueuePage() {
	const playbackState = usePlaybackData()
	const { queue, manuallyAdded: manuallyAddedIds } = playbackState
	const autoTrackIds = queue?.tracks ?? []

	const ids = [...(queue?.tracks ?? []), ...manuallyAddedIds]
	const totalTracks = queue?.tracks.length ?? 0 + manuallyAddedIds.length

	const response: QueryResult<readonly ListItemQueue[]> = useQuery(
		["tracks", ...new Set(ids)],
		() =>
			Result.fromAsyncCatching(database.getTracks(ids)).map((tracks) => {
				const autoTracks = autoTrackIds
					.flatMap(
						(id) => tracks.find(({ id: trackId }) => id === trackId) ?? []
					)
					.map(
						(track, index) =>
							({
								type: "auto" as const,
								track,
								itemIndex: index
							}) satisfies ListItemQueue
					)

				const manualTracks = manuallyAddedIds
					.flatMap(
						(id) => tracks.find(({ id: trackId }) => trackId === id) ?? []
					)
					.map(
						(track, index) =>
							({
								type: "manual",
								track,
								itemIndex: index
							}) satisfies ListItemQueue
					)

				return [...manualTracks, ...autoTracks]
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
						(items) => (
							<QueueView
								items={items}
								isPlayingFromManualQueue={
									playbackState.isPlayingFromManualQueue
								}
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
	items: readonly ListItemQueue[]
	isPlayingFromManualQueue: boolean
	playState: AppState["playback"]["playState"]
}

function QueueView({
	isPlayingFromManualQueue,
	items,
	playState
}: QueueViewProps) {
	const colors = useColors()

	const isEmpty = items.length === 0

	const useListReturn = useList({
		items,

		onSelect: ({ data: { type, itemIndex: index } }) =>
			type === "auto"
				? appState.send({ type: "playIndex", index })
				: appState.send({
						type: "playFromManualQueue",
						index
					}),

		onFocusItem: ({ data: { type, track, itemIndex: index } }) =>
			type === "auto"
				? registerAutoQueueCommands(index, "auto_queue_" + index + track.id)
				: registerManualQueueCommands(index, "manual_" + index + track.id),

		searchKeys: [
			{ name: "Title", getFunction: ({ track }) => track.title ?? track.id }
		]
	})

	if (isEmpty) {
		return (
			<text fg={colors.yellow} margin={1}>
				Queue is empty. Start playing a playlist
			</text>
		)
	}

	return (
		<List
			flexDirection="column"
			register={useListReturn}
			render={({ type, track }, { indexItem, focused }) => (
				<TrackItem
					track={track}
					focused={focused}
					state={
						type === "manual"
							? isPlayingFromManualQueue && indexItem === 0
								? playState === "playing"
									? "playing"
									: playState === "paused"
										? "paused"
										: undefined
								: undefined
							: isPlayingFromManualQueue
								? undefined
								: indexItem === 0
									? playState === "playing"
										? "playing"
										: playState === "paused"
											? "paused"
											: undefined
									: undefined
					}
					color={colors.green}
				/>
			)}
		/>
	)
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
