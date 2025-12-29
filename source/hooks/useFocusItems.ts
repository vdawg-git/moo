import { useKeyboard } from "@opentui/react"
import { useState } from "react"

export type UseFocusReturn = {
	goNext: () => void
	goPrevious: () => void
	goLast: () => void
	goFirst: () => void
	setFocus: React.Dispatch<React.SetStateAction<number>>
	focused: number
}

export type UseFocusArgument = {
	itemsAmount: number
	initialIndex?: number
}

export function useFocusItems({
	itemsAmount,
	initialIndex = 0
}: UseFocusArgument): UseFocusReturn {
	const [focused, setFocused] = useState(initialIndex)
	const lastIndex = itemsAmount - 1

	const goNext = () =>
		setFocused((previous) => {
			const result = previous + 1

			return result > lastIndex ? 0 : result
		})

	const goPrevious = () =>
		setFocused((previous) => {
			const result = previous - 1
			return result < 0 ? lastIndex : result
		})

	const goLast = () => setFocused(lastIndex)
	const goFirst = () => setFocused(0)

	return {
		focused,
		goNext,
		goPrevious,
		setFocus: setFocused,
		goFirst,
		goLast
	}
}

/** Does not use the global keybinding system for now */
export function useFocusItemsKeybings({
	enabled = true,
	focusReturn: { goFirst, goLast, goNext, goPrevious }
}: {
	enabled?: boolean
	focusReturn: UseFocusReturn
}): void {
	useKeyboard((key) => {
		if (!enabled) return

		if (key.name === "left" || key.name === "h") {
			if (key.ctrl) {
				goLast()
			}

			goPrevious()
			return
		}

		if (key.name === "right" || key.name === "l") {
			if (key.ctrl) {
				goFirst()
			}
			goNext()
			return
		}
	})
}
