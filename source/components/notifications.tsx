import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useSelector } from "@xstate/store/react"
import { deepEquals } from "bun"
import { match } from "ts-pattern"
import { appConfig } from "#/config/config"
import { useColors } from "#/hooks/useColors"
import { appState } from "#/state/state"
import { BracketButton } from "./button"
import type { AppColors } from "#/config/theme"
import type { AppNotification } from "#/state/types"

export const notificationModalId = "_notificationModalaid_"

export function NotificationModal() {
	const notifications = useSelector(
		appState,
		(state) => state.context.notifications,
		deepEquals
	)

	useKeyboard((key) => {
		if (key.name === "x") {
			appState.send({ type: "clearNotifications" })
			appState.send({ type: "closeModal", id: notificationModalId })
		}
	})

	const colors = useColors()

	return (
		<box flexDirection="column">
			{notifications.map(({ type, message, id }) => (
				<box key={id} flexDirection="row" gap={1}>
					<NotificationIcon type={type} colors={colors} />
					{typeof message === "object" ? (
						message
					) : (
						<text
							attributes={type === "error" ? TextAttributes.BOLD : undefined}
							fg={type === "error" ? colors.red : colors.fg}
						>
							{message}
						</text>
					)}
				</box>
			))}

			<box
				paddingTop={1}
				onMouse={() => appState.send({ type: "clearNotifications" })}
				flexDirection="row"
			>
				<BracketButton>x</BracketButton>
				<text fg={colors.blue}>Clear notifications</text>
			</box>
		</box>
	)
}

function NotificationIcon({
	type,
	colors
}: {
	type: AppNotification["type"]
	colors: AppColors
}) {
	return match(type)
		.with("default", () => <text fg={colors.blue}>{appConfig.icons.info}</text>)
		.with("error", () => <text fg={colors.red}>{appConfig.icons.error}</text>)
		.with("warn", () => <text fg={colors.yellow}>{appConfig.icons.warn}</text>)
		.with("success", () => (
			<text fg={colors.green}>{appConfig.icons.success}</text>
		))
		.exhaustive()
}
