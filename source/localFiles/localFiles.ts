import { getConfig } from "#/config/config"
import type { Database, Track, TrackData } from "#/database/types"
import type { FilePath } from "#/types/types"
import parseDate from "any-date-parser"
import {
	buffer,
	concat,
	concatMap,
	debounceTime,
	map,
	Observable,
	share,
	Subject,
} from "rxjs"
import { Result } from "typescript-result"
import { watch } from "node:fs"
import { parseBlob, selectCover } from "music-metadata"
import { DATA_DIRECTORY } from "#/constants"
import path from "node:path"

const config = getConfig()

// needs to scan all music directories and parse the music files.
//
// Parsing:
// Rename properties: track, trackOf etc

// TODO figure out what can be played back and parsed
/** The files which can be parsed and played back */
const supportedFormats = ["flac", "mp3"]
/**
 * Files with those formats should generate a warning.
 * Files not in here and {@link supportedFormats} should be ignored.
 */
const unsupportedFormats = ["m4a", "ogg"]

type FileChanged = { filePath: FilePath; type: "change" | "rename" }

function createMusicDirectoriesWatcher(
	directories: readonly FilePath[],
): Observable<FileChanged> {
	return new Observable<FileChanged>((subscriber) => {
		const watchers = directories.map((directory) =>
			watch(directory, { recursive: true }, (type, filePath) => {
				subscriber.next({ type, filePath: filePath as FilePath })
			}),
		)

		return () => watchers.forEach((watcher) => watcher.close())
	}).pipe(share())
}

export async function scanMusicDirectories(
	directories: readonly FilePath[],
): Promise<Result<readonly TrackData[], Error>> {}

export async function updateDatabase(
	musicDirectories: readonly FilePath[],
	database: Database,
): Promise<Result<void, Error>> {
	return Result.fromAsync(scanMusicDirectories(musicDirectories)).map(
		(tracks) => database.addTracks(tracks),
	)
}

/**
 * How long music directory changes are buffered in a debounced way
 * before they are released and processed together
 * */
const bufferWatcherTime = 6_000

export async function watchAndUpdateDatabase(
	musicDirectories: readonly FilePath[],
	database: Database,
): Promise<() => void> {
	const watcher$ = createMusicDirectoriesWatcher(musicDirectories)
	const watcherRelease$ = watcher$.pipe(debounceTime(bufferWatcherTime))

	const subscription = watcher$
		.pipe(
			buffer(watcherRelease$),
			concatMap((changes) => {
				const parsed = changes.map(({ filePath }) => {})
			}),
		)
		.subscribe((tracks) => database.addTracks(tracks))

	return () => subscription.unsubscribe()
}

/**
 * Parse a music file and return the parsed data.
 *
 * Also saves the cover art to the data directory. Errors for that just get ignored.
 */
async function parseMusicFile(
	filePath: FilePath,
): Promise<Result<TrackData, Error>> {
	return Result.fromAsyncCatching(parseBlob(Bun.file(filePath))).map(
		({
			common: {
				track,
				disk,
				comment,
				genre,
				picture,
				composer,
				mixer,
				technician,
				label,
				rating,
				category,
				movementIndex,
				...tags
			},
		}) => {
			const releasedate =
				(tags.releasedate && parseDate.fromString(tags.releasedate)) ||
				undefined

			const coverData = selectCover(picture)
			const coverName =
				coverData && `${Bun.hash(coverData.data)}.${coverData.type}`
			// not so nice, but where would this side-effect make more sense
			if (coverName) {
				const coverPath = path.join(
					DATA_DIRECTORY,
					"pictures/tracks/local/",
					coverName,
				)
				Bun.write(coverPath, coverData.data).catch((error) => {
					console.group()
					console.error(`Failed to save cover image of ${filePath}`)
					console.error(error)
					console.groupEnd()
				})
			}

			return {
				...tags,

				id: filePath,
				type: "local",

				releasedate: releasedate?.valueOf(),

				comment: comment?.join(" "),
				genre: genre?.join(" "),
				composer: composer?.join(" "),
				mixer: mixer?.join(" "),
				technician: technician?.join(" "),
				label: label?.join(" "),
				category: category?.join(" "),

				rating: rating
					?.map((r) => r.rating ?? 0)
					.reduce((previous, current) => Math.max(previous, current)),

				picture: coverName ?? undefined,

				trackNumber: track?.no ?? undefined,
				trackNumberTotal: track?.of ?? undefined,
				disk: disk?.no ?? undefined,
				diskOf: disk?.of ?? undefined,
				movementIndex: movementIndex.no ?? undefined,
				movementIndexTotal: movementIndex.of ?? undefined,
			}
		},
	)
}
