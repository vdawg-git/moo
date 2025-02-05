import Fuse from "fuse.js"
import { useCallback, useEffect, useState } from "react"
import * as R from "remeda"
import {
	type Observable,
	Subject,
	distinctUntilChanged,
	filter,
	map,
	noop,
	shareReplay,
	switchMap,
	tap
} from "rxjs"
import { P, match } from "ts-pattern"
import type { Result } from "typescript-result"
import { appCommands } from "#/commands/commands"
import { appConfig } from "#/config/config"
import { database } from "#/database/database"
import { observeQuery } from "#/database/useQuery"
import { addErrorNotification, appState } from "#/state/state"
import type { RunnerItem } from "./runner"
import { addErrorMessage } from "zod-to-json-schema"
import { logg } from "#/logs"

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

			logg.debug("uuu", { input, query })

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

	const filtered$ = input$.pipe(
		switchMap((input) =>
			results$.pipe(
				map((result) =>
					result?.map(({ items, fuse }) =>
						!input
							? items.slice(0, 15)
							: fuse.search(input, { limit: 15 }).map(({ item }) => item)
					)
				)
			)
		),
		tap((filtered) => logg.debug("filtered", { filtered }))
	)

	const mode$ = inputParsed$.pipe(map(({ toSearch }) => toSearch))

	return {
		input$,
		results$: filtered$,
		mode$
	}
}

async function getPlaylistRunnerItems(): Promise<Result<RunnerItem[], Error>> {
	return (await database.getPlaylists()).map(
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
	return appCommands
		.filter((command) => command.id !== "runner.open")
		.map(({ label, callback, id }) => ({
			id,
			label,
			onSelect: callback
		}))
}

async function getPossibleGotos(): Promise<
	Result<readonly RunnerItem[], Error>
> {
	return getPlaylistRunnerItems()
}
