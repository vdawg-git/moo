import { appConfig } from "#/config/config"
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

export const searchModesList: readonly SearchMode[] = [
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
		icon: appConfig.icons.artist,
		type: "artists"
	},
	{
		prefix: "al:",
		label: "Search albums",
		color: "albums",
		icon: appConfig.icons.album,
		type: "albums"
	},
	{
		prefix: "p:",
		label: "Search playlists",
		color: "playlists",
		icon: appConfig.icons.playlist,
		type: "playlists"
	}
]

export const searchModes = Object.freeze(
	Object.groupBy(searchModesList, (list) => list.type)
) as unknown as Readonly<Record<SearchModeType, SearchMode>>
