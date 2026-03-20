import { TextAttributes } from "@opentui/core"
import { useConfig } from "#/config/configContext"
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
	icon
}: PlaylistTitleProps) {
	// refactor a useIcons hook is nicer
	const config = useConfig()
	const resolvedIcon = icon ?? config.icons.playlist
	const colors = useColors()
	const isEmpty = tracksAmount === 0

	return (
		<box
			justifyContent="space-between"
			flexDirection="row"
			height={1}
			backgroundColor={colors.bg}
			zIndex={5}
		>
			<text fg={color ?? colors.magenta} attributes={TextAttributes.BOLD}>
				{resolvedIcon + "  "}
				{title}{" "}
			</text>
			<text
				fg={isEmpty ? colors.yellow : colors.black}
			>{`${tracksAmount} titles`}</text>
		</box>
	)
}
