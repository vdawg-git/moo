import path from "node:path"
import { useState } from "react"
import { appConfig } from "#/config/config"
import { Input } from "./Input"
import { Select } from "./select"
import type { BaseTrack } from "#/database/types"
import type { AppModalContentProps } from "#/state/types"

type QuickEditModalProps = {
	modal: AppModalContentProps
	track: BaseTrack
}

type TagType = "mood" | "genre"
type Focusable = "input" | "selector" | "suggestions" | "tagType"

export function QuickEditModal({ track }: QuickEditModalProps) {
	const [tagType, setTagType] = useState<TagType>(
		appConfig.quickEdit.defaultTagType
	)
	const [focused, setFocused] = useState<Focusable>("input")
	// I need to be able to:
	// - switch between genre and mood.
	// - Add, remove from the tag list.
	// - Quickly select from tags, ideally with auto-complete.
	//   - And a select component for quick selection.
	// - Hitting escape saves the tags.
	// - Hitting X closes without saving.
	// - Get all moods and genres. Display them in the suggestions
	// Use default tag type for inital selection
	//
	const title = track.title ?? path.basename(track.id)
	const [moods, setMoods] = useState(
		track.mood?.split(appConfig.quickEdit.tagSeperator) ?? []
	)
	const [genres, setGenres] = useState(
		track.genre?.split(appConfig.quickEdit.tagSeperator) ?? []
	)

	return (
		<box>
			<text>{title}</text>

			<Input focused={focused === "input"} />
			<Select focused={focused === "suggestions"} />
		</box>
	)
}
