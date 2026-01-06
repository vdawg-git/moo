import { useColors } from "#/hooks/useColors"
import type { TextProps } from "@opentui/react"

type Props = TextProps & { children: string | readonly string[] }

export function BracketButton({ children, ...rest }: Props) {
	const colors = useColors()

	return (
		<text fg={colors.blue} {...rest}>
			<span fg={colors.brightBlack}>[</span> {children}{" "}
			<span fg={colors.brightBlack}>] </span>
		</text>
	)
}
