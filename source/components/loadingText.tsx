import { useColors } from "#/hooks/useColors"
import type { ReactNode } from "react"

export function LoadingText({ children }: { children?: string }): ReactNode {
	const colors = useColors()

	return <text fg={colors.fg}>{children ?? "Loading..."}</text>
}
