import { appCommands } from "#/commands/appCommands"
import { appConfig } from "#/config/config"
import { database } from "#/database/database"
import { observeQuery } from "#/database/useQuery"
import { addErrorNotification, appState } from "#/state/state"
import Fuse from "fuse.js"
import { useEffect, useState } from "react"
import * as R from "remeda"
import {
	type Observable,
	Subject,
	distinctUntilChanged,
	filter,
	map,
	shareReplay,
	switchMap
} from "rxjs"
import { P, match } from "ts-pattern"
import { Result } from "typescript-result"
import type { RunnerItem } from "./runner"
import { keybindsState } from "#/keybindManager/keybindsState"

type SearchMode = "Playlists" | "Go to" | "Commands"

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
		filter(R.isNonNullish),
		distinctUntilChanged(),
		map(rawInputToPrefixed),
		shareReplay({ refCount: true })
	)

	const results$ = inputParsed$.pipe(
		switchMap((input) => {
			const query = match(input)
				.with(
					{ toSearch: "Commands" },
					() => () => Promise.resolve(getRunnerCommands())
				)
				.with(
					{ toSearch: P.union("Go to", "Playlists") },
					() => getPossibleGotos
				)
				.exhaustive()

			return observeQuery(input.toSearch, query)
		}),
		map((result) =>
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

	const mode$ = inputParsed$.pipe(map(({ toSearch }) => toSearch))

	return {
		input$,
		results$: filtered$,
		mode$
	}
}

async function getPlaylistRunnerItems(): Promise<RunnerItem[]> {
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

	const playlists = await Result.fromAsync(database.getPlaylists())
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

	return [home, ...playlists, queue]
}

function rawInputToPrefixed(input: string): ParsedInput {
	return match(input.toLowerCase().trim())
		.returnType<ParsedInput>()

		.with(P.string.startsWith(">"), (cInput) => ({
			toSearch: "Commands",
			value: cInput.slice(1).trim()
		}))

		.with(P.string.startsWith("p "), (pInput) => ({
			toSearch: "Playlists",
			value: pInput.slice(2).trim()
		}))

		.otherwise((value) => ({ toSearch: "Go to", value }))
}

type ParsedInput = {
	toSearch: SearchMode
	value: string
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

async function getPossibleGotos(): Promise<readonly RunnerItem[]> {
	return getPlaylistRunnerItems()
}
