import { TextAttributes } from "@opentui/core"
import { useColors } from "#/hooks/useColors"
import { useIcons } from "#/hooks/useIcons"
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
	const icons = useIcons()
	const resolvedIcon = icon ?? icons.playlist
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
