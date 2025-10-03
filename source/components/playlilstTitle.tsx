import { Text } from "tuir"
import { appConfig } from "#/config/config"

type PlaylistTitleProps = {
	title: string
	tracksAmount: number
}

export function PlaylistTitle({ title, tracksAmount }: PlaylistTitleProps) {
	return (
		<Text color={"magenta"} bold>
			{appConfig.icons.playlist} {title}{" "}
			<Text color={"gray"}>
				{tracksAmount ? `(${tracksAmount} tracks)` : ""}
			</Text>
		</Text>
	)
}
