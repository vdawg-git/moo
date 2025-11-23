import { TextAttributes } from "@opentui/core"
import { appConfig } from "#/config/config"
import type { AppColor } from "#/constants"

type PlaylistTitleProps = {
	title: string
	tracksAmount: number
	color?: AppColor
	icon?: string
}

export function PlaylistTitle({
	title,
	tracksAmount,
	color = appConfig.colors.playlists,
	icon = appConfig.icons.playlist
}: PlaylistTitleProps) {
	return (
		<box justifyContent="space-between" flexDirection="row" height={1}>
			<text fg={color} attributes={TextAttributes.BOLD}>
				{icon} {title}{" "}
			</text>
			<text fg={"gray"}>{tracksAmount ? `${tracksAmount} titles` : ""}</text>
		</box>
	)
}
