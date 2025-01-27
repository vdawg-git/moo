import { appConfig } from "#/config/config"
import { appState, type AppNotification } from "#/state/state"
import { useSelector } from "@xstate/store/react"
import { deepEquals } from "bun"
import { match } from "ts-pattern"
import { Box, Text, useFocus, useKeymap } from "tuir"
import { BracketButton } from "./button"
import { logg } from "#/logs"

export const notificationModalId = "_notificationModalaid_"

export function NotificationModal() {
	const notifications = useSelector(
		appState,
		(state) => state.context.notifications,
		deepEquals
	)

	const { useEvent } = useKeymap(
		{ clearNotifications: { input: "x" } },
		{ priority: "always" }
	)

	useEvent("clearNotifications", () => {
		appState.send({ type: "clearNotifications" })
		appState.send({ type: "closeModal", id: notificationModalId })
	})

	return (
		<Box flexDirection="column">
			{notifications.map(({ type, message, id }) => (
				<Box key={id}>
					<NotificationIcon type={type} />
					<Text bold={type === "error"}> {message}</Text>
				</Box>
			))}

			<Box
				paddingTop={1}
				onClick={() => appState.send({ type: "clearNotifications" })}
			>
				<Text color={"blue"}>
					<BracketButton>x</BracketButton>
					Clear notifications
				</Text>
			</Box>
		</Box>
	)
}

function NotificationIcon({ type }: { type: AppNotification["type"] }) {
	return match(type)
		.with("default", () => <Text color="blue">{appConfig.icons.info}</Text>)
		.with("error", () => <Text color="red">{appConfig.icons.error}</Text>)
		.with("warn", () => <Text color="yellow">{appConfig.icons.warn}</Text>)
		.with("success", () => <Text color="green">{appConfig.icons.success}</Text>)
		.exhaustive()
}
