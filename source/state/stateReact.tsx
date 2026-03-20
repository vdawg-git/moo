import { deepEquals } from "bun"
import { distinctUntilChanged, filter, map } from "rxjs"
import {
	NotificationModal,
	notificationModalId
} from "#/components/notifications"
import type { Observable } from "rxjs"
import type { AppStore } from "./state"
import type { AppState } from "./types"

/**
 * Will get refactored once its bigger
 */
export function manageNotifications({
	appState,
	appState$
}: {
	readonly appState: AppStore
	readonly appState$: Observable<AppState>
}) {
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
