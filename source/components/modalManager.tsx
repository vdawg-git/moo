import { useKeyboard } from "@opentui/react"
import { useSelector } from "@xstate/store/react"
import { useCallback, useState } from "react"
import { useColors } from "#/hooks/useColors"
import { KeybindingWhenProvider } from "#/keybindManager/useKeybindings"
import { appState } from "#/state/state"
import type { AppModal } from "#/state/types"

export function ModalManager() {
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

	const hideModal = useCallback(() => {
		appState.send({ type: "closeModal", id })
	}, [id])

	useKeyboard((key) => {
		if (key.name === "escape") {
			hideModal()
		}
	})

	return (
		<KeybindingWhenProvider when="modal">
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
					minWidth={5}
				>
					<Content
						onCloseModal={hideModal}
						onChangeTitle={setTitle}
						onChangeColor={(colorName) => setColor(colors[colorName])}
					/>
				</box>
			</box>
		</KeybindingWhenProvider>
	)
}
