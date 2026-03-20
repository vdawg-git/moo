import { Result } from "typescript-result"
import { useAppContext } from "#/appContext"
import { List, useList } from "#/components/list"
import { LoadingText } from "#/components/loadingText"
import { Playbar } from "#/components/playbar"
import { PlaylistTitle } from "#/components/playlilstTitle"
import { TrackItem } from "#/components/tracklist"
import { useQuery } from "#/database/useQuery"
import { useColors } from "#/hooks/useColors"
import { keybinding } from "#/lib/keybinds"
import { getQueueDisplayItems } from "#/pages/queueDisplayItems"
import { createQueryKey } from "#/queryKey"
import { usePlaybackData } from "#/state/useSelectors"
import type { BaseTrack } from "#/database/types"
import type { QueryResult } from "#/database/useQuery"
import type { KeybindManager } from "#/keybindManager/keybindManager"
import type { AppStore } from "#/state/state"

type ListItemQueue = {
	type: "auto" | "manual"
	track: BaseTrack
	/** Original index in the source queue — needed for action dispatch */
	queueIndex: number
	playState: "playing" | "paused" | undefined
}

export function QueuePage() {
	const { database } = useAppContext()
	const playbackState = usePlaybackData()

	const displayItems = getQueueDisplayItems(playbackState)
	const trackIds = displayItems.map((item) => item.trackId)
	const uniqueIds = Array.from(new Set(trackIds))

	const response: QueryResult<readonly ListItemQueue[]> = useQuery(
		createQueryKey.tracks(uniqueIds),
		() =>
			Result.fromAsyncCatching(database.getTracks(trackIds)).map(
				(tracks) => {
					const trackMap = new Map(
						tracks.map((track) => [track.id, track])
					)

					return displayItems.flatMap((item) => {
						const track = trackMap.get(item.trackId)
						if (!track) return []

						return {
							type: item.type,
							track,
							queueIndex: item.queueIndex,
							playState: item.playState
						} satisfies ListItemQueue
					})
				}
			)
	)

	const colors = useColors()

	return (
		<>
			<box flexGrow={1} flexDirection="column">
				<PlaylistTitle
					title={"Queue"}
					tracksAmount={displayItems.length}
				/>

				{response.isLoading ? (
					<LoadingText />
				) : (
					response.data.fold(
						(items) => <QueueView items={items} />,
						(error) => (
							<text fg={colors.red}>Error: {String(error)}</text>
						)
					)
				)}
			</box>

			<Playbar />
		</>
	)
}

type QueueViewProps = {
	items: readonly ListItemQueue[]
}

function QueueView({ items }: QueueViewProps) {
	const { appState, keybindManager } = useAppContext()
	const colors = useColors()

	const isEmpty = items.length === 0

	const useListReturn = useList({
		items,
		keepIndex: true,

		onSelect: ({ data: { type, queueIndex } }) =>
			type === "auto"
				? appState.send({ type: "playIndex", index: queueIndex })
				: appState.send({
						type: "playFromManualQueue",
						index: queueIndex
					}),

		onFocusItem: ({ data: { type, track, queueIndex } }) =>
			type === "auto"
				? registerAutoQueueCommands(
						queueIndex,
						"auto_queue_" + queueIndex + track.id,
						appState,
						keybindManager
					)
				: registerManualQueueCommands(
						queueIndex,
						"manual_" + queueIndex + track.id,
						appState,
						keybindManager
					),

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
			render={({ type, track, playState }, { focused }) => (
				<TrackItem
					track={track}
					focused={focused}
					state={playState}
					color={type === "manual" ? colors.magenta : undefined}
				/>
			)}
		/>
	)
}

function registerManualQueueCommands(
	index: number,
	uid: string,
	appState: AppStore,
	keybindManager: KeybindManager
): () => void {
	return keybindManager.registerKeybinds([
		{
			label: "Remove from queue",
			callback: () => appState.send({ type: "removeFromManualQueue", index }),
			keybindings: keybinding("d"),
			id: uid
		}
	])
}

function registerAutoQueueCommands(
	index: number,
	uid: string,
	appState: AppStore,
	keybindManager: KeybindManager
): () => void {
	return keybindManager.registerKeybinds([
		{
			label: "Remove from queue",
			callback: () => appState.send({ type: "removeFromQueue", index }),
			keybindings: keybinding("d"),
			id: uid
		}
	])
}
