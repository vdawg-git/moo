import { type ScrollBoxProps, useKeyboard } from "@opentui/react"
import {
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState
} from "react"
import { registerKeybinds } from "#/keybindManager/keybindManager"
import { keybinding } from "#/lib/keybinds"
import { logg } from "#/logs"
import type { ScrollBoxRenderable } from "@opentui/core"
import type { Except } from "type-fest"
import type { GeneralCommand } from "#/commands/appCommands"

type ListItemContextData = {
	focused: boolean
	itemIndex: number
}

type UseListReturn<T> = {
	goLast: () => void
	goNext: () => void
	goTop: () => void
	goPrevious: () => void
	scrollDown: () => void
	scrollUp: () => void
	scrollTo: (index: number) => void
	index: number
	setIndex: (index: number) => void
	scrollboxRef: React.RefObject<ScrollBoxRenderable | null>
	items: readonly ListItem<T>[]
}

/**
 * Registers the keybindings for the common list navigations
 * using the `<scrollbox>` component.
 */
export function useList<T>({
	items,
	focused = true,
	name,
	wrapNavigation = false
}: {
	items: readonly ListItem<T>[]
	/**
	 * Wether the cursor should jump back
	 * to the start/end if the navigation goes over the end/start
	 */
	wrapNavigation?: boolean
	focused?: boolean
	/**
	 * Only useful if you want to render multiple lists at once within the same component.
	 * But we dont do that rn, but maybe who knows, life is hectic
	 */
	name?: string
}): UseListReturn<T> {
	const [index, setIndex] = useState(0)
	const scrollboxRef = useRef<ScrollBoxRenderable>(null)
	const id = (name ?? "") + useId()

	const itemsAmount = items.length
	const indexLastElement = itemsAmount - 1

	useEffect(() => {
		if (itemsAmount <= 0) return

		if (index >= itemsAmount) setIndex(0)
	}, [itemsAmount, index])

	const scrollTo = useCallback(
		(newIndex: number) => scrollboxRef.current?.scrollTo(newIndex),
		[]
	)

	const goNext = useCallback(() => {
		if (wrapNavigation && index >= indexLastElement) {
			setIndex(0)
			return
		}

		setIndex((previous) => {
			const newIndex = Math.min(previous + 1, indexLastElement)

			const scrollbox = scrollboxRef.current
			if (scrollbox && previous >= scrollbox.scrollTop + scrollbox.height - 1) {
				scrollbox.scrollBy(1)
			}

			return newIndex
		})
	}, [index, indexLastElement, wrapNavigation])

	const goPrevious = useCallback(() => {
		if (wrapNavigation && index <= 0) {
			setIndex(indexLastElement)
			return
		}

		setIndex((previous) => {
			const newIndex = Math.max(previous - 1, 0)

			const scrollbox = scrollboxRef.current
			if (scrollbox && previous <= scrollbox.scrollTop) {
				scrollbox.scrollTo(index - 1)
			}

			return newIndex
		})
	}, [index, indexLastElement, wrapNavigation])

	const goLast = useCallback(() => {
		setIndex(indexLastElement)
		scrollTo(indexLastElement)
	}, [indexLastElement, scrollTo])

	const goFirst = useCallback(() => {
		setIndex(0)
		scrollTo(0)
	}, [scrollTo])

	const scrollDown = useCallback(() => {
		const scrollbox = scrollboxRef.current
		if (!scrollbox) return

		const { scrollTop } = scrollbox
		const { height } = scrollbox.viewport
		setIndex(
			Math.min(itemsAmount - 1, Math.ceil(scrollTop + height + 1 + height / 2))
		)
		scrollbox.scrollBy(height)
	}, [itemsAmount])

	const scrollUp = useCallback(() => {
		const scrollbox = scrollboxRef.current
		if (!scrollbox) return

		const { scrollTop } = scrollbox
		const { height } = scrollbox.viewport

		setIndex(Math.max(0, Math.ceil(scrollTop - height - 1 + height / 2)))
		scrollbox.scrollBy(-height)
	}, [])

	const selectItem = useCallback(() => {
		const item = items[index]

		item?.onSelect({ focused: true, itemIndex: index })
	}, [items, index])

	useEffect(() => {
		if (!focused) return

		const item = items[index]
		if (!item) {
			logg.warn("no item found #+hg")
			return
		}

		return item.onFocus?.({ focused: true, itemIndex: index })
	}, [items, index, focused])

	useEffect(() => {
		if (!focused) return

		const commands: GeneralCommand[] = [
			{
				id: "next" + id,
				callback: goNext,
				label: "List: Focus next",
				keybindings: keybinding(["j", "down"])
			},
			{
				id: "previous" + id,
				callback: goPrevious,
				label: "List: Focus previous",
				keybindings: keybinding(["k", "up"])
			},
			{
				id: "last" + id,
				callback: goLast,
				label: "List: Scroll to last",
				keybindings: keybinding("G")
			},
			{
				id: "first" + id,
				callback: goFirst,
				label: "List: Scroll to first",
				keybindings: keybinding("g g")
			},
			{
				id: "scrollDown" + id,
				callback: scrollDown,
				label: "List: Scroll down",
				keybindings: keybinding("ctrl+d")
			},
			{
				id: "scrollUp" + id,
				callback: scrollUp,
				label: "List: Scroll up",
				keybindings: keybinding("ctrl+u")
			},
			{
				id: "select" + id,
				callback: selectItem,
				label: "List: Select focused",
				keybindings: keybinding("return")
			}
		]

		return registerKeybinds(commands)
	}, [
		goNext,
		goPrevious,
		goLast,
		goFirst,
		scrollDown,
		scrollUp,
		selectItem,
		id,
		focused
	])

	return {
		goLast,
		goNext,
		goTop: goFirst,
		goPrevious,
		scrollDown,
		scrollUp,
		index,
		setIndex,
		scrollTo,
		scrollboxRef,
		items
	}
}

export function List<T>({
	register,
	...scrollboxProps
}: { register: UseListReturn<T> } & Except<ScrollBoxProps, "children">) {
	if (!register) {
		throw new Error(`List received no proper register prop. It is ${register}`)
	}
	const { index: indexFocused, items, scrollboxRef } = register

	return (
		<scrollbox {...scrollboxProps} ref={scrollboxRef}>
			{items.map((item, itemIndex) => {
				const focused = indexFocused === itemIndex
				return (
					<box
						onMouseDown={() =>
							focused
								? item.onSelect({ focused: true, itemIndex })
								: register.setIndex(itemIndex)
						}
						key={JSON.stringify(item.data)}
					>
						{item.render({
							focused: itemIndex === indexFocused,
							itemIndex
						})}
					</box>
				)
			})}
		</scrollbox>
	)
}

export type ListItem<T> = {
	data: T
	onSelect: (context: ListItemContextData) => void
	onFocus?: (context: ListItemContextData) => void
	render: (context: ListItemContextData) => ReactNode
}
