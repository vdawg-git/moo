import { TextAttributes } from "@opentui/core"
import { useRef, useState } from "react"
import { useAppContext } from "#/appContext"
import { useColors } from "#/hooks/useColors"
import { useIcons } from "#/hooks/useIcons"
import { useCurrentTrack, usePlaybackData } from "#/state/useSelectors"
import type { RGBA } from "@opentui/core"
import type { PlayingState } from "#/types/types"

type BarSegment = {
	readonly text: string
	readonly fg: RGBA
	readonly attributes?: number
}

export function ProgressBar() {
	const containerRef = useRef(null)
	const [barWidth, setBarWidth] = useState(0)
	const { player } = useAppContext()
	const colors = useColors()
	const icons = useIcons()
	const { progress, playState } = usePlaybackData()
	const currentTrack = useCurrentTrack()

	const duration = currentTrack?.duration ?? 0

	const handleSeek = (event: { readonly x: number }) => {
		if (duration <= 0) return

		const container = containerRef.current as { width: number } | null
		if (!container) return

		const seekPosition = (event.x / container.width) * duration
		player.seekTo(Math.floor(seekPosition))
	}

	const fraction = duration > 0 ? Math.min(progress / duration, 1) : 0
	const progressCell = Math.floor(fraction * barWidth)
	const timeText = `${formatTime(progress)}/${formatTime(duration)}`
	const timeStart = Math.floor((barWidth - timeText.length) / 2)

	const segments =
		playState === "stopped"
			? []
			: buildBarSegments({
					barWidth,
					progressCell,
					timeText,
					timeStart,
					colors,
					playState,
					dotIcon: icons.progressDot
				})

	return (
		<box
			flexDirection="row"
			height={1}
			ref={containerRef}
			onSizeChange={function () {
				setBarWidth(this.width)
			}}
			backgroundColor={"transparent"}
			border={playState === "stopped" ? ["bottom"] : undefined}
			borderColor={colors.yellow}
			onMouseUp={handleSeek}
		>
			{segments.length > 0 && (
				<text>
					{segments.map((segment, index) => (
						<span key={index} fg={segment.fg} attributes={segment.attributes}>
							{segment.text}
						</span>
					))}
				</text>
			)}
		</box>
	)
}

/** Builds styled segments for the progress bar with dot indicator and char-by-char time inversion. */
function buildBarSegments({
	barWidth,
	progressCell,
	timeText,
	timeStart,
	colors,
	playState,
	dotIcon
}: {
	readonly barWidth: number
	readonly progressCell: number
	readonly timeText: string
	readonly timeStart: number
	readonly colors: {
		readonly brightYellow: RGBA
		readonly brightBlack: RGBA
		readonly yellow: RGBA
	}
	readonly playState: PlayingState
	readonly dotIcon: string
}): readonly BarSegment[] {
	if (barWidth <= 0) return []

	const timeEnd = timeStart + timeText.length
	const skipTimeDisplay = timeText.length >= barWidth

	const timeFutureFg =
		playState === "playing" ? colors.yellow : colors.brightBlack

	const segments: BarSegment[] = []
	let current: BarSegment | undefined

	for (let index = 0; index < barWidth; index++) {
		const inTime = !skipTimeDisplay && index >= timeStart && index < timeEnd

		const segment = classifyPosition({
			index,
			inTime,
			progressCell,
			timeText,
			timeStart,
			colors,
			timeFutureFg,
			dotIcon
		})

		if (
			current
			&& current.fg === segment.fg
			&& current.attributes === segment.attributes
		) {
			current = { ...current, text: current.text + segment.text }
		} else {
			if (current) segments.push(current)
			current = segment
		}
	}

	if (current) segments.push(current)

	return segments
}

/** Classifies a single position into a styled character. */
function classifyPosition({
	index,
	inTime,
	progressCell,
	timeText,
	timeStart,
	colors,
	timeFutureFg,
	dotIcon
}: {
	readonly index: number
	readonly inTime: boolean
	readonly progressCell: number
	readonly timeText: string
	readonly timeStart: number
	readonly colors: { readonly brightYellow: RGBA; readonly brightBlack: RGBA }
	readonly timeFutureFg: RGBA
	readonly dotIcon: string
}): BarSegment {
	const isPast = index < progressCell

	if (inTime) {
		const char = timeText[index - timeStart]!

		if (isPast) {
			return {
				text: char,
				fg: colors.brightYellow,
				attributes: TextAttributes.INVERSE
			}
		}

		return { text: char, fg: timeFutureFg }
	}

	if (index === progressCell) {
		return { text: dotIcon, fg: colors.brightYellow }
	}

	if (isPast) {
		return { text: "─", fg: colors.brightYellow }
	}

	return { text: "─", fg: colors.brightBlack, attributes: TextAttributes.DIM }
}

/** Formats seconds into "m:ss" or "h:mm:ss" */
function formatTime(seconds: number): string {
	const totalSeconds = Math.floor(seconds)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const secs = totalSeconds % 60

	const paddedSeconds = String(secs).padStart(2, "0")

	if (hours > 0) {
		const paddedMinutes = String(minutes).padStart(2, "0")

		return `${hours}:${paddedMinutes}:${paddedSeconds}`
	}

	return `${minutes}:${paddedSeconds}`
}
