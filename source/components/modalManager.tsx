import { appState } from "#/state/state"
import type { AppModal } from "#/state/types"
import { useSelector } from "@xstate/store/react"
import { useState } from "react"
import { Modal, useModal } from "tuir"

export function ModalManager() {
	const modals = useSelector(appState, (state) => state.context.modals)
	const toRender = modals.at(-1)

	return toRender && <ModalWrapper key={toRender.id} {...toRender} />
}

function ModalWrapper({ Content, id, title }: AppModal) {
	const [displayTitle, setTitle] = useState(title)
	const { modal } = useModal({
		// The manager shows/hide the modal
		show: [],
		hide: [{ key: "esc" }, { input: "q" }]
	})

	const hideModal: (typeof modal)["_hideModal"] = () => {
		appState.send({ type: "closeModal", id })
		modal._hideModal()
	}

	return (
		<Modal
			modal={{ ...modal, _hideModal: hideModal, _vis: true }}
			borderStyle={"round"}
			borderColor={"gray"}
			minHeight={5}
			minWidth={5}
			flexDirection="column"
			titleTopLeft={{ title: displayTitle, bold: true, color: "blue" }}
		>
			<Content closeModal={hideModal} changeTitle={setTitle} />
		</Modal>
	)
}
