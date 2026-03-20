import type { AppConfig } from "#/config/config"
import type { AppColorName } from "#/config/theme"

export type SearchModeType =
	| "playlists"
	| "goTo"
	| "commands"
	| "albums"
	| "artists"

export type SearchMode = {
	label: string
	icon: string
	color: AppColorName
	prefix: string
	type: SearchModeType
}

export function getSearchModesList(
	icons: AppConfig["icons"]
): readonly SearchMode[] {
	return [
		{
			prefix: ">",
			label: "Execute commands",
			color: "commands",
			icon: ">",
			type: "commands"
		},
		{
			prefix: "a:",
			label: "Search artists",
			color: "artists",
			icon: icons.artist,
			type: "artists"
		},
		{
			prefix: "al:",
			label: "Search albums",
			color: "albums",
			icon: icons.album,
			type: "albums"
		},
		{
			prefix: "p:",
			label: "Search playlists",
			color: "playlists",
			icon: icons.playlist,
			type: "playlists"
		}
	]
}

export function getSearchModes(
	icons: AppConfig["icons"]
): Readonly<Record<SearchModeType, SearchMode>> {
	return Object.freeze(
		getSearchModesList(icons).reduce(
			(accumulator, current) => {
				accumulator[current.type] ??= current

				return accumulator
			},
			{} as Record<SearchModeType, SearchMode>
		)
	)
}
