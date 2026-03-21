import { randomUUID } from "node:crypto"
import { logger } from "#/shared/logs"
import type { AppStore } from "#/core/state/state"
import type { NotificationAdd } from "#/core/state/types"

export function createNotificationHelpers({
	appState
}: {
	readonly appState: AppStore
}) {
	function addNotification(notification: NotificationAdd): string {
		const id = randomUUID()
		appState.send({
			type: "addNotification",
			notification: { ...notification, id }
		})

		return id
	}

	function addErrorNotification(
		message: string,
		error?: unknown,
		/** Tag to be used for the logs */
		tag?: string
	) {
		logger.error(tag ? `${tag}: ${message}` : message, error)
		addNotification({ message, type: "error" })
	}

	return { addNotification, addErrorNotification }
}
