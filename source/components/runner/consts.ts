import { appConfig } from "#/config/config"
import type { Color } from "tuir"
import type { Entries, Except } from "type-fest"

export type SearchMode =
	| "playlists"
	| "goTo"
	| "commands"
	| "albums"
	| "artists"

export const searchModes = Object.freeze({
	commands: {
		prefix: ">",
		label: "Execute commands",
		color: appConfig.colors.commands,
		icon: ">"
	},
	artists: {
		prefix: "a:",
		label: "Search artists",
		color: appConfig.colors.artists,
		icon: appConfig.icons.artist
	},
	albums: {
		prefix: "al:",
		label: "Search albums",
		color: appConfig.colors.albums,
		icon: appConfig.icons.album
	},
	playlists: {
		prefix: "p:",
		label: "Search playlists",
		color: appConfig.colors.playlists,
		icon: appConfig.icons.playlist
	}
}) satisfies Except<
	Record<
		SearchMode,
		{ label: string; icon: string; color: Color; prefix: string }
	>,
	"goTo"
>

export const searchModesEntries = Object.entries(searchModes) as Entries<
	typeof searchModes
>
