import { RGBA } from "@opentui/core"
import { type AppColors, themeStream$ } from "#/config/theme"
import { useObservable } from "./hooks"

const defaultColor = RGBA.fromHex("#000")
const defaultProxy = new Proxy({} as unknown as AppColors, {
	get: () => defaultColor
})

export function useColors(): AppColors {
	const colors = useObservable(themeStream$)

	return colors ?? defaultProxy
}
