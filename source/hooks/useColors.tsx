import { RGBA } from "@opentui/core"
import { createContext, useContext } from "react"
import { themeStream$ } from "#/config/theme"
import { useObservable } from "./useObservable"
import type { AppColors } from "#/config/theme"
import type { ReactNode } from "react"

const defaultColor = RGBA.fromHex("#000")
const defaultProxy = new Proxy({} as unknown as AppColors, {
	get: () => defaultColor
})
const ThemeContext = createContext<AppColors>(undefined as unknown as AppColors)

export function ThemeProvider({ children }: { children: ReactNode }) {
	const colors = useObservable(themeStream$)

	return <ThemeContext value={colors ?? defaultProxy}>{children}</ThemeContext>
}

export function useColors(): AppColors {
	const colors = useContext(ThemeContext)

	return colors
}
