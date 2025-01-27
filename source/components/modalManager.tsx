import { logg } from "#/logs"
import { appState, type AppModal } from "#/state/state"
import { useSelector } from "@xstate/store/react"
import { Box, Modal, Text, useFocus, useInput, useKeymap, useModal } from "tuir"

export function ModalManager() {
	const modals = useSelector(appState, (state) => state.context.modals)
	const toRender = modals.at(-1)

	return toRender && <ModalWrapper {...toRender} />
}

function ModalWrapper({ Content, id, title }: AppModal) {
	const { modal } = useModal({
		// 	// The manager shows/hide the modal
		show: { input: "ignore" },
		hide: { key: "esc" }
	})

	const hideModal: (typeof modal)["_hideModal"] = () => {
		appState.send({ type: "closeModal", id })
		modal._hideModal()
	}

	// useInput((input, key) => logg.debug("in", { input, key }), { isActive: true })

	return (
		<Modal
			modal={{ ...modal, _hideModal: hideModal, _vis: true }}
			padding={1}
			borderStyle={"round"}
			borderColor={"gray"}
			minHeight={5}
			minWidth={5}
			flexDirection="column"
			titleTopLeft={{ title, bold: true, color: "magenta" }}
		>
			{/* <Text>ayyy my man why dis no working</Text> */}
			<Content />
		</Modal>
	)
}
