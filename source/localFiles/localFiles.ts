import { readdir, stat } from "node:fs/promises"
import path from "node:path"
import parseDate from "any-date-parser"
import { parseBuffer, selectCover } from "music-metadata"
import * as R from "remeda"
import { pipe } from "remeda"
import {
	buffer,
	concatMap,
	debounceTime,
	distinctUntilChanged,
	filter,
	map,
	merge,
	type Observable,
	share
} from "rxjs"
import { Result } from "typescript-result"
import { DATA_DIRECTORY } from "#/constants"
import { createWatcher } from "#/filesystem"
import { enumarateError, logg } from "#/logs"
import { addErrorNotification } from "#/state/state"
import { supportedFormats } from "./formats"
import type { TrackFileMeta } from "#/database/schema"
import type { Database, TrackData, TrackId } from "#/database/types"
import type { FilePath } from "#/types/types"

export async function updateDatabase(
	musicDirectories: readonly FilePath[],
	database: Database
): Promise<Result<void, Error | readonly Error[]>> {
	return Result.fromAsync(scanMusicDirectories(musicDirectories)).map(
		async (filePaths) => {
			return Result.fromAsync(batchTrackUpdates(filePaths, database))
				.map(({ errors }) => {
					errors.length &&
						addErrorNotification(
							`Errors when updating tracks: ${errors.map((error) => String(error)).join("")}`
						)

					return database.deleteTracksInverted(
						filePaths as unknown as TrackId[]
					)
				})
				.onFailure((failure) => {
					Array.isArray(failure)
						? failure.forEach((error) =>
								addErrorNotification(
									"Error updating",
									error,
									"Error while  updateDatabase"
								)
							)
						: addErrorNotification(
								"Error updating tracks",
								failure,
								"Error while updateDatabase single"
							)
				})
		}
	)
}

type BatchUpdate = Result<
	{ upserted: readonly TrackId[]; errors: readonly Error[] },
	readonly Error[]
>

async function batchTrackUpdates(
	filePaths: readonly FilePath[],
	database: Database
): Promise<BatchUpdate> {
	const BATCH_AMOUNT = 25

	const batches = R.chunk(filePaths, BATCH_AMOUNT)
	const tracksMetadataResult = await database.getTracksFileMetadata()
	if (tracksMetadataResult.isError()) {
		return Result.error([tracksMetadataResult.error])
	}
	const tracksMetadata = tracksMetadataResult.getOrThrow()

	const trackIds: TrackId[] = []
	const errors: Error[] = []
	for (const batch of batches) {
		const filtered = await Promise.all(
			batch.map(async (file) => {
				const metadata = tracksMetadata[file as unknown as TrackId]

				return metadata && (await isSameAsInDatabase(file, metadata))
					? undefined
					: file
			})
		).then(R.filter(R.isNonNullish))

		const { tracksData, parsingErrors } = pipe(
			await Promise.all(filtered.map(parseMusicFile)),
			R.reduce(
				(accumulator, result) => {
					result.fold(
						(data) => accumulator.tracksData.push(data),
						(error) => accumulator.parsingErrors.push(error)
					)
					return accumulator
				},
				{ tracksData: [], parsingErrors: [] } as {
					tracksData: TrackData[]
					parsingErrors: Error[]
				}
			)
		)

		errors.push(...parsingErrors)

		if (tracksData.length === 0) continue

		const result = await database.upsertTracks(tracksData)
		if (result.isError()) {
			return Result.error([result.error, ...errors])
		}

		trackIds.push(...tracksData.map(({ id }) => id))
	}

	return Result.ok({ upserted: trackIds, errors })
}

async function scanMusicDirectories(
	directories: readonly FilePath[]
): Promise<Result<readonly FilePath[], Error>> {
	const files = Result.all(...directories.map(scanMusicDirectory)).map(
		(scannedDirectories) => scannedDirectories.flat()
	)

	return files
}

/**
 * Get the filepaths for the music files in the given directory.
 *
 * The files are not parsed here yet, as this should be done later in batches
 * to prevent clogging up memory for huge dirs.
 */
async function scanMusicDirectory(
	directory: FilePath
): Promise<Result<readonly FilePath[], Error>> {
	return Result.fromAsyncCatching(readdir(directory, { recursive: true })).map(
		(paths) =>
			(paths as FilePath[])
				.filter(isSupportedFile)
				.map((relativePath) => path.join(directory, relativePath) as FilePath)
	)
}

/**
 * How long music directory changes are buffered
 * before they are released and processed together.
 *
 * The time is debounced.
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
				const filesMetadata = await Result.fromAsync(
					database.getTracksFileMetadata()
				)
					.onFailure(
						(error) =>
							addErrorNotification(
								"Failed to update tracks in the background",
								error,
								"getting files metadata failed in watch update"
							) as undefined
					)
					.getOrNull()

				if (!filesMetadata) return

				const parsed: TrackData[] = []
				for (const file of new Set(changes)) {
					const databaseMetadata = filesMetadata[file as unknown as TrackId]

					const shouldSkip =
						!!databaseMetadata &&
						(await isSameAsInDatabase(file, databaseMetadata))

					if (shouldSkip) {
						continue
					}

					const result = await parseMusicFile(file)
					result
						.onSuccess((track) => {
							parsed.push(track)
						})
						.onFailure((error) =>
							addErrorNotification(`Failed to parse track: ${file}`, error)
						)
				}

				return parsed
			}),
			filter(R.isNonNullish)
		)
		.subscribe((tracks) => database.upsertTracks(tracks))

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
			.then((buffer) => parseBuffer(buffer, { path: filePath }))
	).map(async ({ common: { track, picture, ...tags }, format }) => {
		const fileMetaResult = await Result.fromAsyncCatching(stat(filePath))
		if (fileMetaResult.isError()) {
			return fileMetaResult
		}
		const { mtime: mtimeDate, size } = fileMetaResult.getOrThrow()
		const mtime = mtimeDate.valueOf()

		const releasedate =
			(tags.releasedate && parseDate.fromString(tags.releasedate)) || undefined

		const coverData =
			picture &&
			R.pipe(selectCover(picture), (maybePicture) => {
				if (!maybePicture) return undefined
				const name = `${Bun.hash(maybePicture.data)}.${maybePicture.format.split("/").at(-1)}`
				const filePath = path.join(
					DATA_DIRECTORY,
					"pictures/tracks/local/",
					name
				) as FilePath

				return {
					name,
					data: maybePicture.data,
					filePath
				}
			})

		const shouldWriteCover =
			!!coverData &&
			(await Bun.file(coverData.filePath)
				.exists()
				.then((is) => !is)
				.catch(() => false))

		// not so nice, but where would this side-effect make more sense
		if (shouldWriteCover) {
			await Bun.write(coverData.filePath, coverData.data).catch((error) => {
				logg.error(`Failed to save cover image of ${filePath}`, error)
			})
		}

		const {
			duration,
			bitrate,
			codec,
			audioMD5,
			lossless,
			modificationTime,
			trackGain,
			numberOfChannels,
			numberOfSamples,
			tool,
			trackPeakLevel,
			sampleRate,
			bitsPerSample,
			albumGain,
			codecProfile,
			container
		} = format

		const joinedTags = R.mapValues(
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

			picture: coverData?.filePath,

			trackNumber: track?.no ?? undefined,
			trackNumberTotal: track?.of ?? undefined,
			disk: tags.disk?.no ?? undefined,
			diskOf: tags.disk?.of ?? undefined,
			movementIndex: tags.movementIndex.no ?? undefined,
			movementIndexTotal: tags.movementIndex.of ?? undefined,

			bitrate,
			codec,
			audioMD5: audioMD5 && toHexString(audioMD5),
			lossless,
			modificationTime,
			trackGain,
			numberOfChannels,
			numberOfSamples,
			tool,
			trackPeakLevel,
			sampleRate,
			bitsPerSample,
			albumGain,
			codecProfile,
			container,

			mtime,
			size
		} satisfies TrackData
	})
}

function isSupportedFile(filepath: FilePath): boolean {
	const extension = path.extname(filepath).toLowerCase()
	return !!extension && supportedFormats.includes(extension)
}

function toHexString(uint8Array: Uint8Array<ArrayBufferLike>): string {
	return Array.from(uint8Array)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("")
}

function createMusicDirectoriesWatcher(
	directories: readonly FilePath[]
): Observable<FilePath> {
	return merge(
		...directories.map((directory) =>
			createWatcher(directory, { depth: undefined })
		)
	).pipe(
		map(({ filePath }) => filePath),
		distinctUntilChanged(),
		filter(isSupportedFile),
		share()
	)
}

async function isSameAsInDatabase(
	filepath: FilePath,
	metaddata: TrackFileMeta
): Promise<boolean> {
	// TODO fix-me
	return Result.fromAsyncCatching(stat(filepath))
		.map(
			({ mtime, size }) =>
				mtime.valueOf() === metaddata.mtime && size === metaddata.size
		)
		.onFailure((error) => {
			logg.error("failed to stat", { error: enumarateError(error) })
		})
		.getOrDefault(false)
}
