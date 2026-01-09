import { deepEquals } from "bun"
import { distinctUntilChanged, filter, map } from "rxjs"
import {
	NotificationModal,
	notificationModalId
} from "#/components/notifications"
import { appState, appState$ } from "./state"

/**
 * Will get refactored once its bigger
 */
export function manageNotifications() {
	const subscription = appState$
		.pipe(
			filter(
				(state) =>
					state.notifications.length > 0
					&& state.modals.every((modal) => modal.id !== notificationModalId)
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

	return () => subscription.unsubscribe()
}
