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
import { openRunner, type RunnerItem } from "./runner"
import { searchModes, searchModesEntries, type SearchMode } from "./consts"

export function useRunnerItems(): {
	setInput: (input: string | undefined) => void
	items: readonly RunnerItem[]
	mode: SearchMode | undefined
} {
	const [items, setItems] = useState<readonly RunnerItem[]>([])
	const [mode, setMode] = useState<SearchMode | undefined>(undefined)
	const [input, setInput] = useState<string | undefined>()

	// used to bridge rxjs with React
	const [resultsInput$, setResultsInput$] = useState<
		Subject<string | undefined>
	>(new Subject())

	useEffect(() => {
		const { results$, mode$, input$ } = createGetRunnerItems()
		setResultsInput$(input$)

		const subscriptions = [
			results$
				.pipe(
					map(
						(result) =>
							result
								?.onFailure((error) =>
									addErrorNotification("Failed to get search results", error)
								)
								.getOrDefault([]) ?? []
					)
				)
				.subscribe(setItems),

			mode$.subscribe(setMode)
		]

		return () =>
			subscriptions.forEach((subscription) => subscription.unsubscribe())
	}, [])

	useEffect(() => resultsInput$.next(input), [input, resultsInput$])

	return {
		setInput,
		mode,
		items
	}
}

function createGetRunnerItems(): {
	input$: Subject<string | undefined>
	results$: Observable<Result<readonly RunnerItem[], unknown> | undefined>
	mode$: Observable<SearchMode>
} {
	const input$ = new Subject<string | undefined>()
	const inputParsed$ = input$.pipe(
		map((input) => input?.trim()),
		filter(R.isNonNullish),
		distinctUntilChanged(),
		map(rawInputToPrefixed),
		shareReplay({ refCount: true })
	)

	// We get all possible results for each mode, not filtering anything yet,
	// as we want to do fuzzy searching (which SQLite doesnt support)
	const results$ = inputParsed$.pipe(
		switchMap((input) => {
			const queryRunnerItems = getQueryForRunnerItems(input.searchMode)

			return observeQuery(input.searchMode, queryRunnerItems)
		}),
		map((result) =>
			// TODO handle errors
			result.data?.map((items) => ({
				items,
				fuse: new Fuse(items, {
					isCaseSensitive: false,
					findAllMatches: false,
					shouldSort: true,
					keys: ["label", "id"] satisfies (keyof RunnerItem)[]
				})
			}))
		),
		shareReplay({ refCount: true, bufferSize: 1 })
	)

	const filtered$ = inputParsed$.pipe(
		switchMap(({ value }) =>
			results$.pipe(
				map((result) =>
					result?.map(({ items, fuse }) =>
						!value
							? items
							: fuse.search(value, { limit: 35 }).map(({ item }) => item)
					)
				)
			)
		)
	)

	return {
		input$,
		results$: filtered$,
		mode$: inputParsed$.pipe(map(({ searchMode }) => searchMode))
	}
}

async function getPlaylistRunnerItems(): Promise<RunnerItem[]> {
	return Result.fromAsync(database.getPlaylists())
		.map(
			R.map(
				({ displayName, id }) =>
					({
						id: `playlist-${id}`,
						label: displayName ?? id,
						icon: appConfig.icons.playlist,
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

function rawInputToPrefixed(input: string): ParsedInput {
	const searchMode = searchModesEntries.find(([_, { prefix }]) =>
		input.startsWith(prefix)
	)

	return searchMode
		? {
				searchMode: searchMode[0],
				value: input.slice(searchMode[1].prefix.length)
			}
		: { searchMode: "goTo", value: input }
}

type ParsedInput = {
	searchMode: SearchMode
	value: string
}

function getQueryForRunnerItems(
	mode: SearchMode
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
									icon: appConfig.icons.album,
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
		.map(([id, { label, callback }]) => ({
			id,
			label,
			onSelect: callback,
			icon: appConfig.icons.command
		}))
		.toArray()
}

async function getGoTos(): Promise<readonly RunnerItem[]> {
	const artists: RunnerItem = {
		id: "go-to-artists",
		label: "Artists",
		icon: appConfig.icons.artist,
		onSelect: () => openRunner(searchModes.artists.prefix)
	}

	const albums: RunnerItem = {
		id: "go-to-albums",
		label: "Albums",
		icon: appConfig.icons.album,
		onSelect: () => openRunner(searchModes.albums.prefix)
	}

	const home: RunnerItem = {
		id: "all-tracks",
		label: "All tracks",
		icon: appConfig.icons.playlist,
		onSelect: () =>
			appState.send({ type: "navigateTo", goTo: { route: "home" } })
	}

	const queue: RunnerItem = {
		id: "queue-page",
		label: "Queue",
		icon: appConfig.icons.playlist,
		onSelect: () =>
			appState.send({ type: "navigateTo", goTo: { route: "queue" } })
	}

	const playlist = await getPlaylistRunnerItems()

	return [home, artists, albums, queue, ...playlist]
}
