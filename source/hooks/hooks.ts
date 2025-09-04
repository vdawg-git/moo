import type { GeneralCommand } from "#/commands/appCommands"
import {
	registerKeybinds,
	unregisterKeybinds
} from "#/keybindManager/KeybindManager"
import { logg } from "#/logs"
import { useCallback, useEffect, useState } from "react"
import type { Observable } from "rxjs"
import type { useList } from "tuir"

export function useObservable<T>(observable: Observable<T>): T | undefined {
	const [value, setValue] = useState<T | undefined>()

	useEffect(() => {
		const subscription = observable.subscribe((value) => {
			logg.debug("useObservable", { value: JSON.stringify(value), hi: "yo" })
			setValue(value)
		})

		return () => subscription.unsubscribe()
	}, [observable])

	return value
}

/**
 * Registers the keybindings for the common list navigations
 */
export function useRegisterListNavigationCommands({
	control,
	itemsLength: itemsAmount,
	uid
}: {
	control: ReturnType<typeof useList>["control"]
	itemsLength: number
	uid: string
}) {
	const goDown = useCallback(() => control.nextItem(), [control])
	const goUp = useCallback(() => control.prevItem(), [control])
	const goBottom = useCallback(
		() => control.goToIndex(itemsAmount - 1),
		[control, itemsAmount]
	)
	const goTop = useCallback(() => control.goToIndex(0), [control])
	const scrollDown = useCallback(() => control.scrollDown(), [control])
	const scrollUp = useCallback(() => control.scrollUp(), [control])

	useEffect(() => {
		const commands: GeneralCommand[] = [
			{
				id: "down" + uid,
				callback: goDown,
				label: "Go to the next track list item",
				keybindings: [
					[{ key: "j", modifiers: [] }],
					[{ key: "down", modifiers: [] }]
				]
			},
			{
				id: "up" + uid,
				callback: goUp,
				label: "Go to the previous track list item",
				keybindings: [
					[{ key: "k", modifiers: [] }],
					[{ key: "down", modifiers: [] }]
				]
			},
			{
				id: "bottom" + uid,
				callback: goBottom,
				label: "Go to the last list item",
				keybindings: [[{ key: "G", modifiers: [] }]]
			},
			{
				id: "top" + uid,
				callback: goTop,
				label: "Go to the first list item",
				keybindings: [
					[
						{ key: "g", modifiers: [] },
						{ key: "g", modifiers: [] }
					]
				]
			},
			{
				id: "scrollDown" + uid,
				callback: scrollDown,
				label: "Scroll the track list down",
				keybindings: [[{ key: "d", modifiers: ["ctrl"] }]]
			},
			{
				id: "scrollUp" + uid,
				callback: scrollUp,
				label: "Scroll the track list up",
				keybindings: [[{ key: "u", modifiers: ["ctrl"] }]]
			}
		]

		return registerKeybinds(commands)
	}, [goDown, goUp, goBottom, goTop, scrollDown, scrollUp, uid])

	return { goBottom, goDown, goTop, goUp, scrollDown, scrollUp }
}
