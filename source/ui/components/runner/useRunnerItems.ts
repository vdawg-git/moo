import Fuse from "fuse.js"
import { useEffect, useState } from "react"
import * as R from "remeda"
import {
	distinctUntilChanged,
	filter,
	map,
	shareReplay,
	startWith,
	Subject,
	switchMap
} from "rxjs"
import { match, P } from "ts-pattern"
import { Result } from "typescript-result"
import { useAppContext } from "#/app/context"
import { useConfig } from "#/shared/config/configContext"
import type { KeybindManager } from "#/application/keybinds/keybindManager"
import { logger } from "#/shared/logs"
import { getSearchModes, getSearchModesList } from "./consts"
import { openRunner } from "./runner"
import type { AppContext } from "#/app/context"
import type { AppConfig } from "#/shared/config/config"
import type { Observable } from "rxjs"
import type { SearchMode, SearchModeType } from "./consts"
import type { RunnerItem } from "./runner"

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
	const context = useAppContext()
	const config = useConfig()
	const [items, setItems] = useState<readonly RunnerItem[]>([])
	const [mode, setMode] = useState<SearchMode | undefined>(undefined)
	const [input, setInput] = useState<string | undefined>(initialValue)

	// used to bridge rxjs with React
	const [resultsInput$, setResultsInput$] = useState<
		Subject<string | undefined>
	>(new Subject())

	// oxlint-disable eslint-plugin-react-hooks(exhaustive-deps) — context and config are stable
	useEffect(() => {
		const { results$, mode$, input$ } = createGetRunnerItems(
			context,
			config.icons
		)
		setResultsInput$(input$)

		const itemsSubscription = results$.subscribe(setItems)
		const modeSubscription = mode$.subscribe(setMode)

		return () =>
			[itemsSubscription, modeSubscription].forEach((subscription) =>
				subscription.unsubscribe()
			)
	}, [])
	// oxlint-enable eslint-plugin-react-hooks(exhaustive-deps)

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

function createGetRunnerItems(
	context: AppContext,
	icons: AppConfig["icons"]
): {
	input$: Subject<string | undefined>
	results$: Observable<readonly RunnerItem[]>
	mode$: Observable<SearchMode | undefined>
} {
	const { query, database, appState, notifications, keybindManager } = context
	const addErrorNotification = notifications.addError

	const searchModesList = getSearchModesList(icons)

	const input$ = new Subject<string | undefined>()
	const inputParsed$ = input$.pipe(
		map((input) => input?.trim()),
		filter(R.isNonNullish),
		distinctUntilChanged(),
		startWith(""),
		map((input) => rawInputToPrefixed(input, searchModesList)),
		shareReplay({ refCount: true, bufferSize: 1 })
	)

	// We get all possible results for each mode, not filtering anything yet,
	// as we want to do fuzzy searching (which SQLite doesnt support)
	const results$ = inputParsed$.pipe(
		switchMap((input) => {
			const searchModeType: SearchModeType = input.searchMode?.type ?? "goTo"

			const queryRunnerItems = getQueryForRunnerItems(
				searchModeType,
				database,
				appState,
				addErrorNotification,
				icons,
				keybindManager
			)

			return query
				.observeQuery([searchModeType, input.value], queryRunnerItems)
				.pipe(
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
									logger.error("failed to query runner items", error)
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

function rawInputToPrefixed(
	input: string,
	searchModesList: readonly SearchMode[]
): ParsedInput {
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
	mode: SearchModeType,
	database: AppContext["database"],
	appState: AppContext["appState"],
	addErrorNotification: AppContext["notifications"]["addError"],
	icons: AppConfig["icons"],
	keybindManager: KeybindManager
): () => Promise<readonly RunnerItem[]> {
	return match(mode)
		.returnType<() => Promise<readonly RunnerItem[]>>()

		.with("commands", () => () =>
			Promise.resolve(getRunnerCommands(keybindManager))
		)

		.with(
			P.union("goTo", "playlists"),
			() => () => getGoTos(database, appState, icons)
		)

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
											goTo: {
												route: "album",
												parameter: { id: album.id }
											}
										})
								}) satisfies RunnerItem
						)
					)
					.onFailure((error) => {
						addErrorNotification("Failed to get albums", error)
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
											goTo: {
												route: "artist",
												parameter: { id: artist.name }
											}
										})
								}) satisfies RunnerItem
						)
					)
					.onFailure((error) => {
						addErrorNotification("Failed to get artists", error)
					})
					.getOrElse(() => [] as readonly RunnerItem[])
		)

		.exhaustive()
}

function getRunnerCommands(keybindManager: KeybindManager): RunnerItem[] {
	return keybindManager
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

async function getGoTos(
	database: AppContext["database"],
	appState: AppContext["appState"],
	icons: AppConfig["icons"]
): Promise<readonly RunnerItem[]> {
	const searchModes = getSearchModes(icons)

	const artists: RunnerItem = {
		id: "go-to-artists",
		label: "Artists",
		type: "go-to",
		icon: icons.artist,
		onSelect: () => openRunner(appState, searchModes.artists.prefix)
	}

	const albums: RunnerItem = {
		id: "go-to-albums",
		label: "Albums",
		type: "go-to",
		icon: icons.album,
		onSelect: () => openRunner(appState, searchModes.albums.prefix)
	}

	const home: RunnerItem = {
		id: "all-tracks",
		label: "All tracks",
		type: "go-to",
		icon: icons.playlist,
		onSelect: () =>
			appState.send({ type: "navigateTo", goTo: { route: "home" } })
	}

	const queue: RunnerItem = {
		id: "queue-page",
		label: "Queue",
		type: "go-to",
		icon: icons.playlist,
		onSelect: () =>
			appState.send({ type: "navigateTo", goTo: { route: "queue" } })
	}

	const playlist = await getPlaylistRunnerItems(database, appState)

	return [home, artists, albums, queue, ...playlist]
}

async function getPlaylistRunnerItems(
	database: AppContext["database"],
	appState: AppContext["appState"]
): Promise<RunnerItem[]> {
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
		.onFailure((error) => {
			logger.error("Failed to get playlists for search", error)
		})
		.getOrDefault([] as RunnerItem[])
}
