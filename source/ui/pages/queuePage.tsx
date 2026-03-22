import { Result } from "typescript-result"
import { useAppContext } from "#/app/context"
import { keybinding } from "#/shared/library/keybinds"
import { createQueryKey } from "#/shared/queryKey"
import { List, useList } from "#/ui/components/list"
import { LoadingText } from "#/ui/components/loadingText"
import { Playbar } from "#/ui/components/playbar"
import { PlaylistTitle } from "#/ui/components/playlistTitle"
import { TrackItem } from "#/ui/components/tracklist"
import { useColors } from "#/ui/hooks/useColors"
import { useQuery } from "#/ui/hooks/useQuery"
import { usePlaybackQueue } from "#/ui/hooks/useSelectors"
import { getQueueDisplayItems } from "#/ui/pages/queueDisplayItems"
import type { KeybindManager } from "#/application/keybinds/keybindManager"
import type { AppStore } from "#/core/state/state"
import type { BaseTrack } from "#/ports/database"
import type { QueryResult } from "#/ui/hooks/useQuery"

type ListItemQueue = {
	type: "auto" | "manual"
	track: BaseTrack
	/** Original index in the source queue — needed for action dispatch */
	queueIndex: number
	playState: "playing" | "paused" | undefined
}

export function QueuePage() {
	const { database } = useAppContext()
	const queue = usePlaybackQueue()

	const displayItems = getQueueDisplayItems(queue)
	const trackIds = displayItems.map((item) => item.trackId)
	const uniqueIds = Array.from(new Set(trackIds))

	const response: QueryResult<readonly ListItemQueue[]> = useQuery(
		createQueryKey.tracks(uniqueIds),
		() =>
			Result.fromAsyncCatching(database.getTracks(trackIds)).map((tracks) => {
				const trackMap = new Map(tracks.map((track) => [track.id, track]))

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
			})
	)

	const colors = useColors()

	return (
		<>
			<box flexGrow={1} flexDirection="column">
				<PlaylistTitle title={"Queue"} tracksAmount={displayItems.length} />

				{response.isLoading ? (
					<LoadingText />
				) : (
					response.data.fold(
						(items) => <QueueView items={items} />,
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
}

function QueueView({ items }: QueueViewProps) {
	const { appState, keybindManager } = useAppContext()
	const colors = useColors()

	const isEmpty = items.length === 0

	const { register } = useList({
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
			register={register}
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
