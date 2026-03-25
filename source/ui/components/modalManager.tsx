import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { useSelector } from "@xstate/store/react"
import { useCallback, useState } from "react"
import { ZoneProvider } from "#/application/keybinds/useKeybindings"
import { ZONE_MODAL } from "#/core/commands/appCommands"
import { useColors } from "#/ui/hooks/useColors"
import { useAppState } from "#/ui/hooks/useSelectors"
import type { AppModal } from "#/core/state/types"

export function ModalManager() {
	const appState = useAppState()
	const modal = useSelector(
		appState,
		(state) => state.context.modals.at(-1),
		(a, b) => a?.id === b?.id
	)

	return modal && <ModalWrapper key={modal.id} {...modal} />
}

function ModalWrapper({ Content, id, title }: AppModal) {
	const colors = useColors()
	const [displayTitle, setTitle] = useState(title)
	const [color, setColor] = useState(colors.blue)
	const { width: widthScreen } = useTerminalDimensions()
	const widthMax = widthScreen - 4
	const minWidth = Math.max(displayTitle.length + 1, 12)
	const appState = useAppState()

	const hideModal = useCallback(() => {
		appState.trigger.closeModal({ id })
	}, [id, appState])

	useKeyboard((key) => {
		if (key.name === "escape") {
			hideModal()
		}
	})

	return (
		<ZoneProvider zone={ZONE_MODAL} root>
			<box
				zIndex={800}
				flexDirection="column"
				justifyContent="center"
				alignItems="center"
				position="absolute"
				width={"100%"}
				height={"100%"}
			>
				<box
					title={displayTitle}
					titleAlignment={"left"}
					backgroundColor={colors.bg}
					borderStyle={"rounded"}
					borderColor={color}
					minHeight={5}
					maxWidth={widthMax}
					minWidth={minWidth}
				>
					<Content
						closeModal={hideModal}
						changeTitle={setTitle}
						changeColor={(colorName) => setColor(colors[colorName])}
					/>
				</box>
			</box>
		</ZoneProvider>
	)
}
