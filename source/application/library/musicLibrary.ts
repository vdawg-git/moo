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
	share
} from "rxjs"
import { Result } from "typescript-result"
import { logger } from "#/shared/logs"
import { writeTags as realWriteTags } from "./ffmpeg"
import { supportedFormats } from "./formats"
import type { TrackFileMeta } from "#/ports/database"
import type { AppDatabase, TrackData, TrackId } from "#/ports/database"
import type { AppFileSystem } from "#/adapters/filesystem/filesystem"
import type { ErrorNotificationFn, FilePath } from "#/shared/types/types"
import type { IAudioMetadata } from "music-metadata"
import type { Observable } from "rxjs"

export type MusicLibrary = Readonly<{
	/** Scan all directories and sync DB (initial startup) */
	scan(): Promise<Result<void, Error | readonly Error[]>>
	/** Watch directories for changes, auto-update DB. Returns cleanup fn */
	watch(): () => void
	/** Write tags to file, re-parse, update DB */
	updateTags(args: {
		readonly id: TrackId
		readonly genre?: readonly string[]
		readonly mood?: readonly string[]
	}): Promise<void>
}>

export type MusicLibraryDeps = Readonly<{
	fileSystem: AppFileSystem
	database: AppDatabase
	addErrorNotification: ErrorNotificationFn
	musicDirectories: readonly FilePath[]
	tagSeparator: string
	dataDirectory: FilePath
	/** Override for testing — defaults to music-metadata's parseBuffer */
	parseMetadata?: (
		buffer: Uint8Array,
		options: { path: string }
	) => Promise<IAudioMetadata>
	/** Override for testing — defaults to real ffmpeg writeTags */
	writeTags?: typeof realWriteTags
}>

export function createMusicLibrary(deps: MusicLibraryDeps): MusicLibrary {
	const {
		fileSystem,
		database,
		addErrorNotification,
		musicDirectories,
		tagSeparator,
		dataDirectory,
		parseMetadata = parseBuffer,
		writeTags: writeTagsFn = realWriteTags
	} = deps

	// -- Private helpers --

	function isSupportedFile(filepath: FilePath): boolean {
		const extension = path.extname(filepath).toLowerCase()

		return !!extension && supportedFormats.includes(extension)
	}

	async function isSameAsInDatabase(
		filepath: FilePath,
		metadata: TrackFileMeta
	): Promise<boolean> {
		return Result.fromAsyncCatching(fileSystem.stat(filepath))
			.map(
				({ mtime, size }) =>
					mtime.valueOf() === metadata.mtime && size === metadata.size
			)
			.onFailure((error) => {
				logger.error("failed to stat", error)
			})
			.getOrDefault(false)
	}

	async function scanMusicDirectory(
		directory: FilePath
	): Promise<Result<readonly FilePath[], Error>> {
		return Result.fromAsyncCatching(
			fileSystem.readdir(directory, { recursive: true })
		).map((paths) =>
			(paths as FilePath[])
				.filter(isSupportedFile)
				.map((relativePath) => path.join(directory, relativePath) as FilePath)
		)
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
	 * Parse a music file and return the parsed data.
	 * Also saves the cover art to the data directory.
	 */
	async function parseMusicFile(
		filePath: FilePath
	): Promise<Result<TrackData, Error>> {
		return Result.fromAsyncCatching(
			fileSystem
				.readFile(filePath)
				.then((fileBuffer) => parseMetadata(fileBuffer, { path: filePath }))
		).map(async ({ common: { track, picture, ...tags }, format }) => {
			const fileMetaResult = await Result.fromAsyncCatching(
				fileSystem.stat(filePath)
			)
			if (fileMetaResult.isError()) {
				return fileMetaResult
			}
			const { mtime: mtimeDate, size } = fileMetaResult.getOrThrow()
			const mtime = mtimeDate.valueOf()

			const releasedate =
				(tags.releasedate && parseDate.fromString(tags.releasedate))
				|| undefined

			const coverData =
				picture
				&& R.pipe(selectCover(picture), (maybePicture) => {
					if (!maybePicture) return undefined
					const name = `${Bun.hash(maybePicture.data)}.${maybePicture.format.split("/").at(-1)}`
					const coverPath = path.join(
						dataDirectory,
						"pictures/tracks/local/",
						name
					) as FilePath

					return {
						name,
						data: maybePicture.data,
						filePath: coverPath
					}
				})

			const shouldWriteCover =
				!!coverData
				&& (await fileSystem
					.exists(coverData.filePath)
					.then((is) => !is)
					.catch(() => false))

			if (shouldWriteCover) {
				await fileSystem
					.writeFile(coverData.filePath, coverData.data)
					.catch((error) => {
						logger.error(`Failed to save cover image of ${filePath}`, error)
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
				(values) =>
					values
						?.map((value) => (typeof value === "string" ? value : value.text))
						.join(", ")
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
				size,

				genre: joinedTags.genre
					?.split(tagSeparator)
					.map((genre) => genre.trim())
					.filter(R.isNonNullish),
				mood: tags.mood
					?.split(tagSeparator)
					.map((mood) => mood.trim())
					.filter(R.isNonNullish)
			} satisfies TrackData
		})
	}

	async function batchTrackUpdates(
		filePaths: readonly FilePath[]
	): Promise<
		Result<
			{ upserted: readonly TrackId[]; errors: readonly Error[] },
			readonly Error[]
		>
	> {
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
				await Promise.all(filtered.map((file) => parseMusicFile(file))),
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

	function createMusicDirectoriesWatcher(
		directories: readonly FilePath[]
	): Observable<FilePath> {
		return merge(
			...directories.map((directory) =>
				fileSystem.watch(directory, { depth: undefined })
			)
		).pipe(
			map(({ filePath }) => filePath),
			distinctUntilChanged(),
			filter(isSupportedFile),
			share()
		)
	}

	/** Debounce time for buffering file watcher events */
	const bufferWatcherTime = 6_000

	// -- Public API --

	return {
		async scan() {
			return Result.fromAsync(scanMusicDirectories(musicDirectories)).map(
				async (filePaths) => {
					return Result.fromAsync(batchTrackUpdates(filePaths))
						.map(({ errors }) => {
							if (errors.length) {
								addErrorNotification(
									`Errors when updating tracks: ${errors.map((error) => String(error)).join("")}`
								)
							}

							return database.deleteTracksInverted(
								filePaths as unknown as TrackId[]
							)
						})
						.onFailure((failure) => {
							if (Array.isArray(failure)) {
								failure.forEach((error) =>
									addErrorNotification(
										"Error updating",
										error,
										"Error while  updateDatabase"
									)
								)
							} else {
								addErrorNotification(
									"Error updating tracks",
									failure,
									"Error while updateDatabase single"
								)
							}
						})
				}
			)
		},

		watch() {
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
								!!databaseMetadata
								&& (await isSameAsInDatabase(file, databaseMetadata))

							if (shouldSkip) {
								continue
							}

							const result = await parseMusicFile(file)
							result
								.onSuccess((trackData) => {
									parsed.push(trackData)
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
		},

		async updateTags({ id, genre, mood }) {
			await writeTagsFn({ id, genre, mood, tagSeparator })
			const trackResult = await parseMusicFile(id as unknown as FilePath)
			const trackData = trackResult.getOrThrow()

			await database.upsertTracks([trackData])
		}
	}
}

function toHexString(uint8Array: Uint8Array<ArrayBufferLike>): string {
	return Array.from(uint8Array)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("")
}
