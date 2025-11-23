import { colors } from "#/constants"
import type { TextProps } from "@opentui/react"

type Props = TextProps & { children: string }

export function BracketButton({ children, ...rest }: Props) {
	return (
		<text {...rest}>
			<span fg={colors.brightBlack}>[</span> {children}{" "}
			<span fg={colors.brightBlack}>] </span>
		</text>
	)
}
