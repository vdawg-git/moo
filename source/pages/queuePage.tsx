import { Playbar } from "#/components/playbar"
import { PlaylistTitle } from "#/components/playlilstTitle"
import { TrackItem } from "#/components/tracklist"
import { database } from "#/database/database"
import type { BaseTrack, TrackId } from "#/database/types"
import { useQuery } from "#/database/useQuery"
import { useRegisterListNavigationCommands } from "#/hooks/hooks"
import { registerKeybinds } from "#/keybindManager/KeybindManager"
import { appState } from "#/state/state"
import type { AppState } from "#/state/types"
import { useCurrentTrack, usePlaybackData } from "#/state/useSelectors"
import { useId } from "react"
import { Box, List, Text, useList } from "tuir"
import { Result } from "typescript-result"

export function QueuePage() {
	const playbackState = usePlaybackData()
	const { queue, manuallyAdded } = playbackState

	const ids = [...(queue?.tracks ?? []), ...manuallyAdded]
	const totalTracks = queue?.tracks.length ?? 0 + manuallyAdded.length

	const response = useQuery(["tracks", ...new Set(ids)], () =>
		Result.fromAsyncCatching(database.getTracks(ids)).map((tracks) => {
			const tracksMap = new Map<TrackId, BaseTrack>()
			for (const track of tracks) {
				tracksMap.set(track.id, track)
			}

			return tracksMap
		})
	)

	return (
		<>
			<Box flexGrow={1} flexDirection="column">
				<PlaylistTitle title={"Queue"} tracksAmount={totalTracks} />

				{response.isLoading ? (
					<Text>Loading...</Text>
				) : (
					response.data.fold(
						(tracksMap) => (
							<QueueView playbackState={playbackState} tracksMap={tracksMap} />
						),
						(error) => <Text color={"red"}>Error: {String(error)}</Text>
					)
				)}
			</Box>

			<Playbar />
		</>
	)
}

type QueueViewProps = {
	tracksMap: Map<TrackId, BaseTrack>
	playbackState: AppState["playback"]
}

function QueueView({
	playbackState: {
		manuallyAdded: manuallyAddedIds,
		queue,
		index: playIndex,
		isPlayingFromManualQueue,
		playState,
		shuffleMap
	},
	tracksMap
}: QueueViewProps) {
	const tracksAmount = manuallyAddedIds.length + (queue?.tracks.length ?? 0)
	const isEmpty = tracksAmount === 0
	const uid = useId()

	const addedAutoIds = (queue?.tracks ?? []).slice(playIndex)

	const ids: readonly TrackId[] = [...manuallyAddedIds, ...addedAutoIds]

	const manuallyAdded = manuallyAddedIds.map((id) => {
		const track = tracksMap.get(id)
		if (!track) throw new Error(`Failed to get track from tracksMap: ${id}`)
		return track
	})

	const autoAdded = addedAutoIds.map((id) => {
		const track = tracksMap.get(id)
		if (!track) throw new Error(`Failed to get track from tracksMap: ${id}`)
		return track
	})

	const { listView, control } = useList(ids.length, { navigation: "none" })

	useRegisterListNavigationCommands({
		control,
		uid: "queue_" + uid,
		itemsLength: ids.length
	})

	if (isEmpty) {
		return <Text>Queue is empty. Start playing a playlist</Text>
	}

	return (
		<Box>
			<List flexDirection="column" listView={listView}>
				{manuallyAdded.map((track, index) => (
					<TrackItem
						track={track}
						onPlay={() =>
							appState.send({
								type: "playFromManualQueue",
								index
							})
						}
						state={
							isPlayingFromManualQueue && index === 0
								? playState === "playing"
									? "playing"
									: playState === "paused"
										? "paused"
										: undefined
								: undefined
						}
						color={"green"}
						// biome-ignore lint/suspicious/noArrayIndexKey: Thats how it is
						key={track.id + index}
						onFocus={() =>
							registerManualQueueCommands(index, "manual_" + index + track.id)
						}
					/>
				))}

				{autoAdded.slice(0, 200).map((track, index) => (
					<TrackItem
						track={track}
						onPlay={() =>
							appState.send({ type: "playIndex", index: playIndex + index + 1 })
						}
						state={
							isPlayingFromManualQueue
								? undefined
								: index === 0
									? playState === "playing"
										? "playing"
										: playState === "paused"
											? "paused"
											: undefined
									: undefined
						}
						onFocus={() =>
							registerAutoQueueCommands(index, "manual_" + index + track.id)
						}
						// biome-ignore lint/suspicious/noArrayIndexKey: Thats how it is
						key={track.id + index}
					/>
				))}
			</List>
		</Box>
	)
}

function registerManualQueueCommands(index: number, uid: string): () => void {
	return registerKeybinds([
		{
			label: "Remove from queue",
			callback: () => appState.send({ type: "removeFromManualQueue", index }),
			keybindings: [[{ key: "d", modifiers: [] }]],
			id: uid
		}
	])
}

function registerAutoQueueCommands(index: number, uid: string): () => void {
	return registerKeybinds([
		{
			label: "Remove from queue",
			callback: () => appState.send({ type: "removeFromQueue", index }),
			keybindings: [[{ key: "d", modifiers: [] }]],
			id: uid
		}
	])
}
