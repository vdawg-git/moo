import { TextAttributes } from "@opentui/core"
import { appConfig } from "#/config/config"
import { useColors } from "#/hooks/useColors"
import type { AppColor } from "#/config/theme"

type PlaylistTitleProps = {
	title: string
	tracksAmount: number
	color?: AppColor
	icon?: string
}

export function PlaylistTitle({
	title,
	tracksAmount,
	color,
	icon = appConfig.icons.playlist
}: PlaylistTitleProps) {
	const colors = useColors()

	return (
		<box
			justifyContent="space-between"
			flexDirection="row"
			height={1}
			backgroundColor={colors.bg}
			zIndex={5}
		>
			<text fg={color ?? colors.magenta} attributes={TextAttributes.BOLD}>
				{icon} {title}{" "}
			</text>
			<text fg={"gray"}>{tracksAmount ? `${tracksAmount} titles` : ""}</text>
		</box>
	)
}
