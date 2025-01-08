import { getConfig } from "#/config/config"
import type { Database, Track, TrackData } from "#/database/types"
import type { FilePath } from "#/types/types"
import parseDate from "any-date-parser"
import {
	buffer,
	concat,
	concatMap,
	debounceTime,
	distinctUntilChanged,
	map,
	merge,
	Observable,
	of,
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

type FileChanged = {
	/** The absolute filepath which changed */
	filePath: FilePath
	type: "change" | "rename"
}

function createWatcher(toWatch: string): Observable<FileChanged> {
	return new Observable<FileChanged>((subscriber) => {
		const watcher = watch(toWatch, { recursive: true }, (type, filePath) => {
			if (!filePath) return

			subscriber.next({
				type,
				filePath: path.join(toWatch, filePath) as FilePath,
			})
		})

		return () => watcher.close()
	}).pipe(
		distinctUntilChanged(
			(previous, current) =>
				JSON.stringify(previous) === JSON.stringify(current),
		),
		share(),
	)
}

function createMusicDirectoriesWatcher(
	directories: readonly FilePath[],
): Observable<FileChanged> {
	return merge(...directories.map(createWatcher)).pipe(share())
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
const bufferWatcherTime = 4_000

export async function watchAndUpdateDatabase(
	musicDirectories: readonly FilePath[],
	database: Database,
): Promise<() => void> {
	const watcher$ = createMusicDirectoriesWatcher(musicDirectories)
	const watcherRelease$ = watcher$.pipe(debounceTime(bufferWatcherTime))

	const subscription = watcher$
		.pipe(
			buffer(watcherRelease$),
			concatMap(async (changes) => {
				// TODO notify on errors
				const parsed: TrackData[] = []
				for (const file of new Set(changes.map(({ filePath }) => filePath))) {
					const resut = await parseMusicFile(file)
					resut.onFailure(console.error).onSuccess((track) => {
						parsed.push(track)
					})
				}

				return parsed
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
		async ({
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
			let coverName =
				coverData && `${Bun.hash(coverData.data)}.${coverData.type}`
			// not so nice, but where would this side-effect make more sense
			if (coverName && coverData) {
				const coverPath = path.join(
					DATA_DIRECTORY,
					"pictures/tracks/local/",
					coverName,
				)
				// TODO put this somewhere else
				await Bun.write(coverPath, coverData.data).catch((error) => {
					coverName = null
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
