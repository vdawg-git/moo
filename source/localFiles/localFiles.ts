import { readdir } from "node:fs/promises"
import path from "node:path"
import parseDate from "any-date-parser"
import { parseBuffer, selectCover } from "music-metadata"
import { mapValues } from "remeda"
import {
	buffer,
	type Observable,
	concatMap,
	debounceTime,
	distinctUntilChanged,
	filter,
	map,
	merge,
	share
} from "rxjs"
import { Result } from "typescript-result"
import { DATA_DIRECTORY } from "#/constants"
import type { Database, TrackData, TrackId } from "#/database/types"
import { createWatcher } from "#/filesystem"
import { logg } from "#/logs"
import { addErrorNotification } from "#/state/state"
import type { FilePath } from "#/types/types"
import { supportedFormats } from "./formats"

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
				addErrorNotification("Errors adding tracks:", { errors })
			}
			logg.debug(`Adding ${tracks.length} tracks to db...`)

			return tracks.length > 0 ? database.addTracks(tracks) : undefined
		}
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
				const parsed: TrackData[] = []
				for (const file of new Set(changes)) {
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
	).map(async ({ common: { track, picture, ...tags }, format }) => {
		const releasedate =
			(tags.releasedate && parseDate.fromString(tags.releasedate)) || undefined

		const coverData = selectCover(picture)
		let coverName = coverData && `${Bun.hash(coverData.data)}.${coverData.type}`
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
			container
		} satisfies TrackData
	})
}

function isSupportedFile(filepath: FilePath): boolean {
	const extension = path.extname(filepath)
	return extension === "" ? false : supportedFormats.includes(extension)
}

function toHexString(uint8Array: Uint8Array<ArrayBufferLike>): string {
	return Array.from(uint8Array)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("")
}
