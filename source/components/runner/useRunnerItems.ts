import Fuse from "fuse.js"
import { useEffect, useState } from "react"
import * as R from "remeda"
import {
	distinctUntilChanged,
	filter,
	map,
	type Observable,
	Subject,
	shareReplay,
	startWith,
	switchMap
} from "rxjs"
import { match, P } from "ts-pattern"
import { Result } from "typescript-result"
import { appConfig } from "#/config/config"
import { database } from "#/database/database"
import { observeQuery } from "#/database/useQuery"
import { keybindsState } from "#/keybindManager/keybindsState"
import { enumarateError, logg } from "#/logs"
import { addErrorNotification, appState } from "#/state/state"
import {
	type SearchMode,
	type SearchModeType,
	searchModes,
	searchModesList
} from "./consts"
import { openRunner, type RunnerItem } from "./runner"

type ParsedInput = {
	searchMode: SearchMode | undefined
	value: string
}

export function useRunnerItems({
	initialValue
}: {
	initialValue: string | undefined
}): {
	setInput: (input: string | undefined) => void
	input: string | undefined
	items: readonly RunnerItem[]
	mode: SearchMode | undefined
} {
	const [items, setItems] = useState<readonly RunnerItem[]>([])
	const [mode, setMode] = useState<SearchMode | undefined>(undefined)
	const [input, setInput] = useState<string | undefined>(initialValue)

	// used to bridge rxjs with React
	const [resultsInput$, setResultsInput$] = useState<
		Subject<string | undefined>
	>(new Subject())

	useEffect(() => {
		const { results$, mode$, input$ } = createGetRunnerItems()
		setResultsInput$(input$)

		const itemsSubscription = results$.subscribe(setItems)
		const modeSubscription = mode$.subscribe(setMode)

		return () =>
			[itemsSubscription, modeSubscription].forEach((subscription) =>
				subscription.unsubscribe()
			)
	}, [])

	useEffect(() => resultsInput$.next(input), [input, resultsInput$])
	useEffect(
		() => resultsInput$.next(initialValue),
		[initialValue, resultsInput$]
	)

	return {
		setInput,
		mode,
		items,
		input
	}
}

function createGetRunnerItems(): {
	input$: Subject<string | undefined>
	results$: Observable<readonly RunnerItem[]>
	mode$: Observable<SearchMode | undefined>
} {
	const input$ = new Subject<string | undefined>()
	const inputParsed$ = input$.pipe(
		map((input) => input?.trim()),
		filter(R.isNonNullish),
		distinctUntilChanged(),
		startWith(""),
		map(rawInputToPrefixed),
		shareReplay({ refCount: true })
	)

	// We get all possible results for each mode, not filtering anything yet,
	// as we want to do fuzzy searching (which SQLite doesnt support)
	const results$ = inputParsed$.pipe(
		switchMap((input) => {
			const searchModeType: SearchModeType = input.searchMode?.type ?? "goTo"

			const queryRunnerItems = getQueryForRunnerItems(searchModeType)

			return observeQuery([searchModeType, input.value], queryRunnerItems).pipe(
				map(
					(result) =>
						result.data?.fold(
							(items) =>
								input.value
									? new Fuse(items, {
											isCaseSensitive: false,
											findAllMatches: false,
											shouldSort: true,
											keys: ["label", "id"] satisfies (keyof RunnerItem)[]
										})
											.search(input.value, { limit: 35 })
											.map(({ item }) => {
												return item
											})
									: items,
							(error) => {
								logg.error("failed to query runner items", {
									error: enumarateError(error)
								})
								return []
							}
						) ?? []
				)
			)
		})
	)

	return {
		input$,
		results$,
		mode$: inputParsed$.pipe(map(({ searchMode }) => searchMode))
	}
}

function rawInputToPrefixed(input: string): ParsedInput {
	const searchMode = searchModesList.find(({ prefix }) =>
		input.startsWith(prefix)
	)

	return searchMode
		? {
				searchMode,
				value: input.slice(searchMode.prefix.length).trim()
			}
		: { searchMode: undefined, value: input.trim() }
}

function getQueryForRunnerItems(
	mode: SearchModeType
): () => Promise<readonly RunnerItem[]> {
	return match(mode)
		.returnType<() => Promise<readonly RunnerItem[]>>()

		.with("commands", () => () => Promise.resolve(getRunnerCommands()))

		.with(P.union("goTo", "playlists"), () => getGoTos)

		.with(
			"albums",
			() => () =>
				database
					.getAlbums()
					.map(
						R.map(
							(album) =>
								({
									id: album.id,
									label: album.title,
									type: "album",
									onSelect: () =>
										appState.send({
											type: "navigateTo",
											goTo: { route: "album", parameter: { id: album.id } }
										})
								}) satisfies RunnerItem
						)
					)
					.onFailure((error) => {
						addErrorNotification("Failed to get albums", error)
						logg.error("Failed to get albums", {
							error: enumarateError(error)
						})
					})
					.getOrElse(() => [] as readonly RunnerItem[])
		)

		.with(
			"artists",
			() => () =>
				database
					.getArtists()
					.map(
						R.map(
							(artist) =>
								({
									id: artist.name,
									label: artist.name,
									type: "artist",
									onSelect: () =>
										appState.send({
											type: "navigateTo",
											goTo: { route: "artist", parameter: { id: artist.name } }
										})
								}) satisfies RunnerItem
						)
					)
					.onFailure((error) => {
						addErrorNotification("Failed to get artists", error)
						logg.error("Failed to get artists", {
							error: enumarateError(error)
						})
					})
					.getOrElse(() => [] as readonly RunnerItem[])
		)

		.exhaustive()
}

/** A function because otherwise we have circular imports  */
function getRunnerCommands(): RunnerItem[] {
	return keybindsState
		.getAllCommands()
		.entries()
		.map(
			([id, { label, callback }]) =>
				({
					id,
					label,
					onSelect: callback,
					type: "command"
				}) satisfies RunnerItem
		)
		.toArray()
}

async function getGoTos(): Promise<readonly RunnerItem[]> {
	const artists: RunnerItem = {
		id: "go-to-artists",
		label: "Artists",
		type: "go-to",
		icon: appConfig.icons.artist,
		onSelect: () => openRunner(searchModes.artists.prefix)
	}

	const albums: RunnerItem = {
		id: "go-to-albums",
		label: "Albums",
		type: "go-to",
		icon: appConfig.icons.album,
		onSelect: () => openRunner(searchModes.albums.prefix)
	}

	const home: RunnerItem = {
		id: "all-tracks",
		label: "All tracks",
		type: "go-to",
		icon: appConfig.icons.playlist,
		onSelect: () =>
			appState.send({ type: "navigateTo", goTo: { route: "home" } })
	}

	const queue: RunnerItem = {
		id: "queue-page",
		label: "Queue",
		type: "go-to",
		icon: appConfig.icons.playlist,
		onSelect: () =>
			appState.send({ type: "navigateTo", goTo: { route: "queue" } })
	}

	const playlist = await getPlaylistRunnerItems()

	return [home, artists, albums, queue, ...playlist]
}

async function getPlaylistRunnerItems(): Promise<RunnerItem[]> {
	return Result.fromAsync(database.getPlaylists())
		.map(
			R.map(
				({ displayName, id }) =>
					({
						id: `playlist-${id}`,
						label: displayName ?? id,
						type: "playlist",
						onSelect: () =>
							appState.send({
								type: "navigateTo",
								goTo: { route: "playlist", parameter: { id } }
							})
					}) satisfies RunnerItem
			)
		)
		.onFailure((error) =>
			addErrorNotification("Failed to get playlists for search", error)
		)
		.getOrDefault([] as RunnerItem[])
}
