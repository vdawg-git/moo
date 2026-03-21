import { createStore } from "@xstate/store"
import { useSelector } from "@xstate/store/react"
import { deepEquals } from "bun"
import Fuse from "fuse.js"
import { useEffect, useId, useRef } from "react"
import { useKeybindings } from "#/application/keybinds/useKeybindings"
import { keybinding } from "#/shared/lib/keybinds"
import { logger } from "#/shared/logs"
import type { ScrollBoxRenderable } from "@opentui/core"
import type { ListItem } from "./listTypes"

/** Opaque handle consumed by the `List` component. Page code should not reach into this. */
export type ListRegister<T> = {
	readonly scrollboxRef: React.RefObject<ScrollBoxRenderable | null>
	readonly items: readonly ListItem<T>[]
	readonly index: number
	readonly mode: ListMode
	readonly searchString: string | undefined
	readonly setSearchString: (searchString: string) => void
	readonly setMode: (mode: ListMode) => void
	readonly setIndex: (index: number) => void
	readonly setScrollboxSize: (size: {
		scrollboxHeight: number
		viewportHeight: number
	}) => void
	readonly onSelect: (item: ListItem<T>) => void
}

/** Consumer-facing return value of `useList`. */
export type UseListResult<T> = {
	register: ListRegister<T>
	index: number
	items: readonly ListItem<T>[]
	setIndex: (index: number) => void
}

export type UseListArgument<T> = {
	items: readonly T[]

	onSelect: (item: ListItem<T>) => void

	/**
	 * Gets called when the an item gets selected.
	 * The returned function function gets called when the item gets unselected again.
	 */

	onFocusItem?: (item: ListItem<T>) => void | (() => void)

	/** Required to make the list searchable. Should have at least one item */
	searchKeys?: {
		name: string
		/** The function to get the search data from the list item */
		getFunction: (data: T) => string
	}[]

	/** If set, makes the list controlled. */
	index?: number

	focused?: boolean
	/**
	 * Only useful if you want to render multiple lists at once within the same component.
	 * But we dont do that rn, but maybe who knows, life is hectic
	 */
	name?: string

	/** How closely the search results should match the input. Default is quite strict */
	searchThreshold?: number

	/** When true, preserve cursor position when items change instead of resetting to 0 */
	keepIndex?: boolean

	/** When set, scrolls to center this original item index if it's off-screen. Does not move cursor. */
	centerOnIndex?: number
}

/**
 * Registers the keybindings for the common list navigations
 * using the `<scrollbox>` component.
 */
export function useList<T>({
	items: itemsUnfiltered,
	name,
	searchKeys,
	searchThreshold = 0.1,
	focused = true,
	index: indexProp,
	keepIndex = false,
	centerOnIndex,
	onFocusItem,
	onSelect
}: UseListArgument<T>): UseListResult<T> {
	const scrollboxRef = useRef<ScrollBoxRenderable>(null)
	const id = (name ?? "") + useId()

	const stateRef = useRef(
		null as unknown as ReturnType<typeof createListState<T>>
	)
	if (!stateRef.current) {
		stateRef.current = createListState<T>({
			items: itemsUnfiltered,
			searchKeys,
			searchThreshold
		})
	}

	const index = useSelector(
		stateRef.current.state,
		({ context }) => context.index
	)
	const searchString = useSelector(
		stateRef.current.state,
		({ context }) => context.searchString
	)
	const items = useSelector(
		stateRef.current.state,
		({ context }) => context.items
	)
	const mode = useSelector(
		stateRef.current.state,
		({ context }) => context.mode
	)

	const onFocusItemRef = useRef(onFocusItem)
	onFocusItemRef.current = onFocusItem

	useEffect(() => {
		if (!focused) return

		let unfocusFunction: (() => void) | void = undefined

		const subscription = stateRef.current.state
			.select(({ index, items }) => ({ index, items }))
			.subscribe(({ items, index }) => {
				const item = items[index]

				unfocusFunction?.()
				unfocusFunction = item && onFocusItemRef.current?.(item)
			})

		const { items, index: currentIndex } = stateRef.current.state.get().context
		const currentItem = items[currentIndex]
		if (currentItem) {
			unfocusFunction = onFocusItemRef.current?.(currentItem)
		}

		return () => {
			unfocusFunction?.()
			subscription.unsubscribe()
		}
	}, [focused])

	useEffect(() => {
		const action = keepIndex ? "updateItems" : "setItems"
		stateRef.current.state.trigger[action]({
			items: itemsUnfiltered
		})
	}, [itemsUnfiltered, keepIndex])

	const indexRef = useRef(index)
	indexRef.current = index

	useEffect(() => {
		if (indexProp === undefined || indexProp === indexRef.current) return

		stateRef.current.state.trigger.setIndex({ index: indexProp })
	}, [indexProp])

	useEffect(() => {
		if (centerOnIndex === undefined) return

		stateRef.current.state.trigger.centerIfNotVisible({
			itemIndex: centerOnIndex
		})
	}, [centerOnIndex])

	useKeybindings(
		() => [
			{
				id: "next" + id,
				callback: stateRef.current.state.trigger.goNext,
				label: "List: Focus next",
				keybindings: keybinding(["j", "down"])
			},
			{
				id: "previous" + id,
				callback: stateRef.current.state.trigger.goPrevious,
				label: "List: Focus previous",
				keybindings: keybinding(["k", "up"])
			},
			{
				id: "last" + id,
				callback: stateRef.current.state.trigger.goLast,
				label: "List: Scroll to last",
				keybindings: keybinding("G")
			},
			{
				id: "first" + id,
				callback: stateRef.current.state.trigger.goFirst,
				label: "List: Scroll to first",
				keybindings: keybinding("g g")
			},
			{
				id: "scrollDown" + id,
				callback: stateRef.current.state.trigger.scrollDown,
				label: "List: Scroll down",
				keybindings: keybinding("ctrl+d")
			},
			{
				id: "scrollUp" + id,
				callback: stateRef.current.state.trigger.scrollUp,
				label: "List: Scroll up",
				keybindings: keybinding("ctrl+u")
			},
			{
				id: "select" + id,
				callback: () => {
					const { context } = stateRef.current.state.get()
					const item = context.items[context.index]

					if (item) {
						onSelect(item)
					} else {
						logger.warn("useList: Did not found matching onSelect item", {
							index: context.index
						})
					}
				},
				label: "List: Select focused item",
				keybindings: keybinding("return")
			}
		],
		{ enabled: focused }
	)

	useKeybindings(
		() => [
			{
				id: "list_search_" + id,
				callback: () =>
					stateRef.current.state.trigger.setMode({ mode: "searchInput" }),
				keybindings: keybinding("/"),
				label: "List: Search"
			}
		],
		{ enabled: mode === "default" && !!searchKeys }
	)
	useKeybindings(
		() => [
			{
				id: "list_exit_search_" + id,
				callback: () =>
					stateRef.current.state.trigger.setMode({ mode: "default" }),
				keybindings: [[{ key: "escape", modifiers: [] }]],
				label: "List: Exit search"
			}
		],
		{ enabled: mode === "searchInput" && !!searchKeys }
	)

	useEffect(() => {
		const subscription = stateRef.current.state
			.select((context) => context.scrollPosition)
			.subscribe((scrollPosition) => {
				scrollboxRef.current?.scrollTo(scrollPosition)
			})

		return () => subscription.unsubscribe()
	}, [])

	const setIndex = (index: number) =>
		stateRef.current.state.trigger.setIndex({ index })

	const register: ListRegister<T> = {
		index,
		scrollboxRef,
		items,
		searchString,
		mode,
		setIndex,
		setMode: (mode) => stateRef.current.state.trigger.setMode({ mode }),
		setSearchString: (searchString) =>
			stateRef.current.state.trigger.setSearchString({ searchString }),
		setScrollboxSize: (size) =>
			stateRef.current.state.trigger.setScrollboxSize(size),
		onSelect
	}

	return { register, index, items, setIndex }
}

type ListState<T> = {
	items: readonly ListItem<T>[]
	/** Raw unfiltered source items — used as search base and for shallow comparison */
	itemsSource: readonly T[]
	searchString?: string
	index: number
	scrollPosition: number
	scrollboxHeight: number
	viewportHeight: number
	mode: ListMode
}

type ListMode = "default" | "searchInput"

/** Minimal scroll adjustment to make targetIndex visible. */
function computeScrollToShow(
	targetIndex: number,
	scrollPosition: number,
	scrollboxHeight: number
): number {
	if (
		targetIndex >= scrollPosition
		&& targetIndex < scrollPosition + scrollboxHeight
	) {
		return scrollPosition
	}

	if (targetIndex < scrollPosition) {
		return targetIndex
	}

	return targetIndex - scrollboxHeight + 1
}

export function createListState<T>({
	items: itemsUnfiltered,
	searchKeys = [],
	searchThreshold
}: {
	items: readonly T[]
	/** Required to make the list searchable. Should have at least one item */
	searchKeys?: {
		name: string
		/** The function to get the search data from the list item */
		getFunction: (data: T) => string
	}[]

	/** How closely the search results should match the input. Default is quite strict */
	searchThreshold?: number
}) {
	const defaultState: ListState<T> = {
		index: 0,
		items: itemsUnfiltered.map((item, index) => ({ data: item, index })),
		itemsSource: itemsUnfiltered,
		searchString: undefined,
		scrollPosition: 0,
		scrollboxHeight: 0,
		viewportHeight: 0,
		mode: "default"
	}

	const state = createStore({
		context: defaultState,
		on: {
			setItems: (context, { items: newItems }: { items: readonly T[] }) => {
				if (deepEquals(context.itemsSource, newItems)) return context

				return {
					...context,
					itemsSource: newItems,
					items: newItems.map((item, index) => ({ data: item, index })),
					index: 0
				}
			},

			updateItems: (context, { items: newItems }: { items: readonly T[] }) => {
				if (deepEquals(context.itemsSource, newItems)) return context

				const items = newItems.map((item, index) => ({
					data: item,
					index
				}))

				return {
					...context,
					itemsSource: newItems,
					items,
					index: Math.min(context.index, Math.max(0, items.length - 1)),
					scrollPosition: Math.min(
						context.scrollPosition,
						Math.max(0, items.length - 1)
					)
				}
			},

			setIndex: (context, { index }: { index: number }) => ({
				...context,
				index
			}),

			clearSearch: (context) => ({
				...context,
				searchString: undefined
			}),

			setMode: (context, { mode }: { mode: ListMode }) => ({
				...context,
				mode
			}),

			setSearchString: (
				context,
				{ searchString }: { searchString: string }
			) => {
				const allItems = context.itemsSource.map((item, index) => ({
					data: item,
					index
				}))

				if (!searchString) {
					return {
						...context,
						index: 0,
						items: allItems,
						searchString
					}
				}

				const items = new Fuse(allItems, {
					keys: searchKeys.map((key) => ({
						...key,
						getFn: (item: ListItem<T>) => key.getFunction(item.data)
					})),
					shouldSort: true,
					threshold: searchThreshold
				})
					.search(searchString)
					.map((result) => result.item)

				return {
					...context,
					searchString,
					items,
					index: 0
				}
			},

			setScrollPosition: (
				context,
				{ scrollPosition }: { scrollPosition: number }
			) => ({ ...context, scrollPosition }),

			setScrollboxSize: (
				context,
				{
					scrollboxHeight,
					viewportHeight
				}: { scrollboxHeight: number; viewportHeight: number }
			) => ({ ...context, scrollboxHeight, viewportHeight }),

			goNext: (context) => {
				if (context.scrollboxHeight <= 0) return context

				const newIndex = Math.min(context.index + 1, context.items.length - 1)
				const scrollPosition = computeScrollToShow(
					newIndex,
					context.scrollPosition,
					context.scrollboxHeight
				)

				return { ...context, index: newIndex, scrollPosition }
			},

			goPrevious: (context) => {
				if (context.scrollboxHeight <= 0) return context

				const newIndex = Math.max(context.index - 1, 0)
				const scrollPosition = computeScrollToShow(
					newIndex,
					context.scrollPosition,
					context.scrollboxHeight
				)

				return { ...context, index: newIndex, scrollPosition }
			},

			goLast: (context) => {
				const indexLastElement = context.items.length - 1

				return {
					...context,
					index: indexLastElement,
					scrollPosition: indexLastElement
				}
			},

			goFirst: (context) => ({
				...context,
				index: 0,
				scrollPosition: 0
			}),

			scrollDown: (context) => {
				if (context.viewportHeight <= 0) return context

				const newScrollPosition =
					context.scrollPosition + context.viewportHeight
				const newIndex = Math.min(
					context.items.length - 1,
					Math.ceil(newScrollPosition + context.viewportHeight / 2)
				)
				const scrollPosition = computeScrollToShow(
					newIndex,
					newScrollPosition,
					context.scrollboxHeight
				)

				return { ...context, index: newIndex, scrollPosition }
			},

			scrollUp: (context) => {
				if (context.viewportHeight <= 0) return context

				const newScrollPosition =
					context.scrollPosition - context.viewportHeight
				const newIndex = Math.max(
					0,
					Math.ceil(newScrollPosition + context.viewportHeight / 2)
				)
				const scrollPosition = computeScrollToShow(
					newIndex,
					newScrollPosition,
					context.scrollboxHeight
				)

				return { ...context, index: newIndex, scrollPosition }
			},

			centerIfNotVisible: (
				context,
				{ itemIndex }: { itemIndex: number }
			) => {
				if (context.scrollboxHeight <= 0) return context

				const displayIndex = context.items.findIndex(
					(item) => item.index === itemIndex
				)
				if (displayIndex === -1) return context

				if (
					displayIndex >= context.scrollPosition
					&& displayIndex
						< context.scrollPosition + context.scrollboxHeight
				) {
					return context
				}

				const scrollPosition = Math.max(
					0,
					displayIndex - Math.floor(context.scrollboxHeight / 2)
				)

				return { ...context, scrollPosition }
			}
		}
	})

	return {
		state
	}
}
