import { distinctUntilChanged, filter, map } from "rxjs"
import { appState, appState$ } from "./state"
import {
	notificationModalId,
	NotificationModal
} from "#/components/notifications"
import { deepEquals } from "bun"

/**
 * Will get refactored once its bigger
 */
export function manageNotifications() {
	const modals = appState$
		.pipe(
			filter(
				(state) =>
					state.notifications.length > 0 &&
					state.modals.every((modal) => modal.id !== notificationModalId)
			),
			map((state) => state.notifications.map(({ id }) => id)),
			distinctUntilChanged(deepEquals)
		)
		.subscribe((_notifications) => {
			appState.send({
				type: "addModal",
				modal: {
					id: notificationModalId,
					title: "Notifications",
					Content: () => <NotificationModal />
				}
			})
		})

	return () => [modals].forEach((subscription) => subscription.unsubscribe())
}
