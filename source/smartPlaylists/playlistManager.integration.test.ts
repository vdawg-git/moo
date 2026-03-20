import { describe, expect, it, mock } from "bun:test"
import { createMemoryDatabase } from "#/database/createMemoryDatabase"
import {
	createTestFileSystem,
	testPlaylistsDirectory
} from "#/testing/testFileSystem"
import { createPlaylistManager } from "./playlistManager"
import type { PlaylistId } from "#/database/types"
import type { TestFileSystem } from "#/testing/testFileSystem"
import type { FilePath } from "#/types/types"

const validPlaylistYaml = `
name: Test Playlist
rules:
  - all:
      - artist:
          includes: "Test Artist"
`

const anotherPlaylistYaml = `
name: Rock Playlist
rules:
  - any:
      - genre:
          includes: "rock"
`

const invalidYaml = `
this is: [not valid: yaml: playlist
`

async function createTestManager(overrides?: { fileSystem?: TestFileSystem }) {
	const fileSystem = overrides?.fileSystem ?? createTestFileSystem()
	const addErrorNotification = mock(() => {})
	const database = await createMemoryDatabase()
	const manager = createPlaylistManager({
		fileSystem,
		database,
		addErrorNotification,
		playlistsDirectory: testPlaylistsDirectory as FilePath
	})

	return { manager, database, fileSystem, addErrorNotification }
}

describe("playlistManager integration", () => {
	it("should parse YAML playlists and sync to DB on scanAll", async () => {
		const { fileSystem, manager, database } = await createTestManager()
		fileSystem.addPlaylist("test", validPlaylistYaml)
		fileSystem.addPlaylist("rock", anotherPlaylistYaml)
		fileSystem.setFile(`${testPlaylistsDirectory}/readme.txt`, "not a playlist")

		await manager.scanAll()

		const playlists = await database.getPlaylists()
		const result = playlists.getOrThrow()
		expect(result).toHaveLength(2)

		const names = result.map(({ id }) => id as string).sort()
		expect(names).toEqual(["rock", "test"])
	})

	it("should remove deleted playlists from DB on scanAll", async () => {
		const { fileSystem, manager, database } = await createTestManager()
		fileSystem.addPlaylist("test", validPlaylistYaml)
		fileSystem.addPlaylist("rock", anotherPlaylistYaml)

		await manager.scanAll()
		expect((await database.getPlaylists()).getOrThrow()).toHaveLength(2)

		// refactor also add removeTrack and removePlaylist helpers
		fileSystem.removeFile(`${testPlaylistsDirectory}/rock.yml`)
		await manager.scanAll()

		const playlists = await database.getPlaylists()
		expect(playlists.getOrThrow()).toHaveLength(1)
		expect(playlists.getOrThrow()[0]!.id).toBe("test" as PlaylistId)
	})

	it("should call error notification for invalid YAML without crashing", async () => {
		const { fileSystem, manager, addErrorNotification } =
			await createTestManager()
		fileSystem.addPlaylist("bad", invalidYaml)

		await manager.scanAll()

		expect(addErrorNotification).toHaveBeenCalled()
	})

	it("should get a blueprint by ID with correct name and rules", async () => {
		const { fileSystem, manager } = await createTestManager()
		fileSystem.addPlaylist("test", validPlaylistYaml)

		const blueprint = await manager.getBlueprint("test" as PlaylistId)

		expect(blueprint.isOk()).toBe(true)
		const parsed = blueprint.getOrThrow()
		expect(parsed.name).toBe("Test Playlist")
		expect(parsed.rules).toHaveLength(1)
		expect(parsed.rules[0]!._type).toBe("all")
		expect(parsed.rules[0]!.fields).toHaveLength(1)

		const field = parsed.rules[0]!.fields[0]!
		expect(field).toMatchObject({
			_type: "column",
			column: "artist",
			rules: { includes: "Test Artist", _type: "string" }
		})
	})

	it("should return error for missing blueprint", async () => {
		const { manager } = await createTestManager()

		const result = await manager.getBlueprint("nonexistent" as PlaylistId)

		expect(result.isError()).toBe(true)
	})

	it("should handle empty playlists directory", async () => {
		const { manager, database } = await createTestManager()

		await manager.scanAll()

		const playlists = await database.getPlaylists()
		expect(playlists.getOrThrow()).toHaveLength(0)
	})
})
