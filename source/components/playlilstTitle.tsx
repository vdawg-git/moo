import { Text, type Color } from "tuir"
import { appConfig } from "#/config/config"

type PlaylistTitleProps = {
	title: string
	tracksAmount: number
	color?: Color
	icon?: string
}

export function PlaylistTitle({
	title,
	tracksAmount,
	color = appConfig.colors.playlists,
	icon = appConfig.icons.playlist
}: PlaylistTitleProps) {
	return (
		<Text color={color} bold>
			{icon} {title}{" "}
			<Text color={"gray"}>
				{tracksAmount ? `(${tracksAmount} tracks)` : ""}
			</Text>
		</Text>
	)
}
