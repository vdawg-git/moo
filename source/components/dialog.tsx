import { useKeyboard } from "@opentui/react"
import { useColors } from "#/hooks/useColors"
import type { BoxProps } from "@opentui/react"
import type { ReactNode } from "react"

export type DialogProps = { open: boolean; onClose?: () => void } & BoxProps

/**
 * Does not automatically position itself in the center.
 * OpenTui does not support a `fixed` mode, so we resolve to using `absolute`
 */
export function Dialog({ open, onClose, ...boxProps }: DialogProps): ReactNode {
	const colors = useColors()

	useKeyboard((key) => {
		if (key.name === "escape") {
			onClose?.()
			return
		}
	})

	return (
		open && (
			<box
				minHeight={"100%"}
				minWidth={"100%"}
				width={"100%"}
				height={"100%"}
				zIndex={200}
				position="absolute"
				justifyContent="center"
				alignItems="center"
			>
				<box
					position="absolute"
					border
					borderStyle="rounded"
					borderColor={colors.fg}
					backgroundColor={colors.bg}
					minWidth={15}
					minHeight={15}
					{...boxProps}
				/>
			</box>
		)
	)
}
