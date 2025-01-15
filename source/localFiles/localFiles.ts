import { config } from "#/config/config"
import type { Database, Track, TrackData, TrackId } from "#/database/types"
import type { FilePath } from "#/types/types"
import parseDate from "any-date-parser"
import {
	buffer,
	concat,
	concatMap,
	debounceTime,
	distinctUntilChanged,
	distinctUntilKeyChanged,
	filter,
	map,
	merge,
	Observable,
	of,
	share,
	Subject
} from "rxjs"
import { Result, type AsyncResult } from "typescript-result"
import { watch } from "node:fs"
import {
	parseBlob as parseTagsFromBlob,
	parseWebStream,
	parseBuffer,
	selectCover
} from "music-metadata"
import { DATA_DIRECTORY } from "#/constants"
import path from "node:path"
import { mapValues } from "remeda"
import { readdir } from "node:fs/promises"

// needs to scan all music directories and parse the music files.
//
// Parsing:
// Rename properties: track, trackOf etc

// TODO figure out what can be played back and parsed
/** The files which can be parsed and played back */
const supportedFormats = [".flac", ".mp3"]
/**
 * Files with those formats should generate a warning.
 * Files not in here and {@link supportedFormats} should be ignored.
 *
 * Not used yet.
 */
const _unsupportedFormats = ["m4a", "ogg"]

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
				filePath: path.join(toWatch, filePath) as FilePath
			})
		})

		return () => watcher.close()
	}).pipe(
		distinctUntilChanged(
			(previous, current) =>
				JSON.stringify(previous) === JSON.stringify(current)
		),
		share()
	)
}

function createMusicDirectoriesWatcher(
	directories: readonly FilePath[]
): Observable<FilePath> {
	return merge(...directories.map(createWatcher)).pipe(
		map(({ filePath }) => filePath),
		distinctUntilChanged(),
		filter(isSupportedFile),
		share()
	)
}

export async function scanMusicDirectories(
	directories: readonly FilePath[]
): Promise<readonly Result<TrackData, Error>[]> {
	const files = (await Promise.all(directories.map(scanMusicDirectory))).flat()

	return files
}

async function scanMusicDirectory(
	directory: FilePath
): Promise<readonly Result<TrackData, Error>[]> {
	return Result.fromAsyncCatching(readdir(directory, { recursive: true }))
		.map((paths) =>
			(paths as FilePath[])
				.filter(isSupportedFile)
				.map((relativePath) => path.join(directory, relativePath) as FilePath)
				.map(parseMusicFile)
		)
		.fold(
			(ok) => Promise.all(ok),
			(error) => [Result.error(error)]
		)
}

export async function updateDatabase(
	musicDirectories: readonly FilePath[],
	database: Database
): Promise<Result<void, Error>> {
	return Result.fromAsync(scanMusicDirectories(musicDirectories)).map(
		(trackResults) => {
			const { tracks, errors } = trackResults
				.map((track) => track.toTuple())
				.reduce(
					(accumulator, [track, error]) => {
						if (track) {
							accumulator.tracks.push(track)
						}
						if (error) {
							accumulator.errors.push(error)
						}

						return accumulator
					},
					{ tracks: [] as TrackData[], errors: [] as Error[] }
				)

			if (errors.length > 0) {
				// TODO notify errors
				console.error("Errors adding tracks:", errors)
			}
			console.log(`Adding ${tracks.length} tracks to db...`)

			return tracks.length > 0 ? database.addTracks(tracks) : undefined
		}
	)
}

/**
 * How long music directory changes are buffered in a debounced way
 * before they are released and processed together
 * */
const bufferWatcherTime = 6_000

export function watchAndUpdateDatabase(
	musicDirectories: readonly FilePath[],
	database: Database
): () => void {
	const watcher$ = createMusicDirectoriesWatcher(musicDirectories)
	const watcherRelease$ = watcher$.pipe(debounceTime(bufferWatcherTime))

	const subscription = watcher$
		.pipe(
			buffer(watcherRelease$),
			concatMap(async (changes) => {
				// TODO notify on errors
				const parsed: TrackData[] = []
				for (const file of new Set(changes)) {
					const result = await parseMusicFile(file)
					result.onFailure(console.error).onSuccess((track) => {
						parsed.push(track)
					})
				}

				return parsed
			})
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
	filePath: FilePath
): Promise<Result<TrackData, Error>> {
	return Result.fromAsyncCatching(
		Bun.file(filePath)
			.arrayBuffer()
			.then((buffer) => new Uint8Array(buffer))
			.then((buffer) =>
				parseBuffer(buffer, { path: filePath }, { duration: true })
			)
	).map(
		async ({
			common: { track, picture, ...tags },
			format: { duration, bitrate, codec }
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
					coverName
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

			const joinedTags = mapValues(
				{
					comment: tags.comment,
					genre: tags.genre,
					composer: tags.composer,
					mixer: tags.mixer,
					technician: tags.technician,
					label: tags.label,
					category: tags.category,
					djmixer: tags.djmixer,
					writer: tags.writer,
					remixer: tags.remixer,
					arranger: tags.arranger,
					engineer: tags.engineer,
					publisher: tags.publisher,
					catalognumber: tags.catalognumber,
					releasetype: tags.releasetype,
					isrc: tags.isrc,
					performerInstrument: tags["performer:instrument"],
					lyricist: tags.lyricist,
					conductor: tags.conductor,
					producer: tags.producer,
					keywords: tags.keywords
				} satisfies Partial<Record<keyof TrackData, unknown>>,
				(value) => value?.join(", ")
			)

			return {
				...tags,

				id: filePath as unknown as TrackId,
				sourceProvider: "local",

				releasedate: releasedate?.isValid() ? releasedate : undefined,

				duration: duration ?? 0,

				...joinedTags,

				rating: tags.rating
					?.map((r) => r.rating ?? 0)
					.reduce((previous, current) => Math.max(previous, current)),

				picture: (coverName as FilePath | null) ?? undefined,

				trackNumber: track?.no ?? undefined,
				trackNumberTotal: track?.of ?? undefined,
				disk: tags.disk?.no ?? undefined,
				diskOf: tags.disk?.of ?? undefined,
				movementIndex: tags.movementIndex.no ?? undefined,
				movementIndexTotal: tags.movementIndex.of ?? undefined,

				bitrate,
				codec
			} satisfies TrackData
		}
	)
}

function isSupportedFile(filepath: FilePath): boolean {
	const extension = path.extname(filepath)
	return extension === "" ? false : supportedFormats.includes(extension)
}
