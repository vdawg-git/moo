import {
	useKeybindings,
	ZoneProvider
} from "#/application/keybinds/useKeybindings"
import { useColors } from "#/ui/hooks/useColors"
import type { BoxProps } from "@opentui/react"
import type { AppCommandID } from "#/core/commands/definitions"
import type { ReactNode } from "react"

export type DialogProps = { open: boolean; onClose?: () => void } & BoxProps

/**
 * Does not automatically position itself in the center.
 * OpenTui does not support a `fixed` mode, so we resolve to using `absolute`
 */
export function Dialog({ open, onClose, ...boxProps }: DialogProps): ReactNode {
	if (!open) return null

	return (
		<ZoneProvider zone="modal" root>
			<DialogContent onClose={onClose} {...boxProps} />
		</ZoneProvider>
	)
}

function DialogContent({
	onClose,
	...boxProps
}: Omit<DialogProps, "open">): ReactNode {
	const colors = useColors()

	useKeybindings(
		() => [
			{
				commandId: "abort",
				callback: () => onClose?.()
			}
		],
		{ allowDuringInput: true }
	)

	return (
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
}
