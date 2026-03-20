import { describe, expect, it, mock } from "bun:test"
import { createMemoryDatabase } from "#/database/createMemoryDatabase"
import { createTestFileSystem } from "#/testing/testFileSystem"
import { createMusicLibrary } from "./musicLibrary"
import type { TrackId } from "#/database/types"
import type { FilePath } from "#/types/types"
import type { IAudioMetadata } from "music-metadata"

function mockParseMetadata(
	buffer: Uint8Array,
	options: { path: string }
): Promise<IAudioMetadata> {
	const text = new TextDecoder().decode(buffer)
	const overrides = (() => {
		try {
			return JSON.parse(text) as Record<string, unknown>
		} catch {
			return {}
		}
	})()

	return Promise.resolve({
		common: {
			title: (overrides.title as string) ?? `Track ${options.path}`,
			artist: (overrides.artist as string) ?? "Test Artist",
			album: (overrides.album as string) ?? "Test Album",
			track: { no: 1, of: 10 },
			disk: { no: 1, of: 1 },
			movementIndex: { no: undefined, of: undefined }
		},
		format: {
			duration: 180,
			bitrate: 320000,
			codec: "FLAC",
			sampleRate: 44100
		},
		native: {},
		quality: { warnings: [] }
	} as unknown as IAudioMetadata)
}

async function createTestLibrary(overrides?: {
	musicDirectories?: readonly string[]
	parseMetadata?: typeof mockParseMetadata
	writeTags?: () => Promise<void>
}) {
	const fileSystem = createTestFileSystem()
	const database = await createMemoryDatabase()
	const addErrorNotification = mock(() => {})

	const library = createMusicLibrary({
		fileSystem,
		database,
		addErrorNotification,
		musicDirectories: (overrides?.musicDirectories ?? [
			"/music"
		]) as readonly FilePath[],
		tagSeparator: "|",
		dataDirectory: "/data" as FilePath,
		parseMetadata: overrides?.parseMetadata ?? mockParseMetadata,
		writeTags: overrides?.writeTags
	})

	return { library, fileSystem, database, addErrorNotification }
}

describe("musicLibrary integration", () => {
	it("should add new tracks to DB on scan", async () => {
		const { library, fileSystem, database } = await createTestLibrary()

		fileSystem.addTrack("song.flac")
		fileSystem.addTrack("album/track.mp3")

		await library.scan()

		const tracks = await database.getTracks()
		expect(tracks.getOrThrow()).toHaveLength(2)
	})

	it("should ignore unsupported file extensions", async () => {
		const { library, fileSystem, database } = await createTestLibrary()

		fileSystem.addTrack("song.flac")
		fileSystem.setFile("/music/readme.txt", new Uint8Array([2]))
		fileSystem.setFile("/music/cover.jpg", new Uint8Array([3]))

		await library.scan()

		const tracks = await database.getTracks()
		expect(tracks.getOrThrow()).toHaveLength(1)
	})

	it("should remove tracks from DB when files are deleted", async () => {
		const { library, fileSystem, database } = await createTestLibrary()

		fileSystem.addTrack("song1.flac")
		fileSystem.addTrack("song2.flac")
		await library.scan()
		expect((await database.getTracks()).getOrThrow()).toHaveLength(2)

		// Remove one file and rescan
		fileSystem.removeFile("/music/song2.flac")
		await library.scan()

		const tracks = await database.getTracks()
		expect(tracks.getOrThrow()).toHaveLength(1)
		expect(tracks.getOrThrow()[0]!.id).toBe(
			"/music/song1.flac" as unknown as TrackId
		)
	})

	it("should skip re-parse when mtime and size are unchanged", async () => {
		const parseMetadata = mock(mockParseMetadata)
		const { library, fileSystem } = await createTestLibrary({
			parseMetadata
		})

		fileSystem.addTrack("song.flac", { mtime: new Date("2025-01-01") })

		await library.scan()
		expect(parseMetadata).toHaveBeenCalledTimes(1)

		// Second scan — same mtime/size, should skip parse
		await library.scan()
		expect(parseMetadata).toHaveBeenCalledTimes(1)
	})

	it("should re-parse when mtime changes", async () => {
		const parseMetadata = mock(mockParseMetadata)
		const { library, fileSystem } = await createTestLibrary({
			parseMetadata
		})

		fileSystem.addTrack("song.flac", { mtime: new Date("2025-01-01") })
		await library.scan()
		expect(parseMetadata).toHaveBeenCalledTimes(1)

		fileSystem.addTrack("song.flac", { mtime: new Date("2025-06-01") })
		await library.scan()
		expect(parseMetadata).toHaveBeenCalledTimes(2)
	})

	it("should call writeTags and re-parse on updateTags", async () => {
		const writeTags = mock(async () => {})
		const { library, fileSystem } = await createTestLibrary({ writeTags })

		const trackPath = "/music/song.flac"
		fileSystem.addTrack(trackPath)
		await library.scan()

		await library.updateTags({
			id: trackPath as unknown as TrackId,
			genre: ["Rock", "Metal"]
		})

		expect(writeTags).toHaveBeenCalledTimes(1)
		expect(writeTags).toHaveBeenCalledWith({
			id: trackPath,
			genre: ["Rock", "Metal"],
			mood: undefined,
			tagSeparator: "|"
		})
	})

	it("should handle multiple music directories", async () => {
		const { library, fileSystem, database } = await createTestLibrary({
			musicDirectories: ["/music1", "/music2"]
		})

		fileSystem.addTrack("song.flac", { directory: "/music1" })
		fileSystem.addTrack("song.mp3", { directory: "/music2" })

		await library.scan()

		const tracks = await database.getTracks()
		expect(tracks.getOrThrow()).toHaveLength(2)
	})
})
