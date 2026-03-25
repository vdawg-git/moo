import { describe, expect, it, mock } from "bun:test"
import { createMemoryDatabase } from "#/adapters/sqlite/createMemoryDatabase"
import {
	createTestFileSystem,
	testPlaylistsDirectory
} from "#/test-helpers/testFileSystem"
import { createPlaylistManager } from "./playlistManager"
import type { PlaylistId } from "#/ports/database"
import type { FilePath } from "#/shared/types/types"
import type { TestFileSystem } from "#/test-helpers/testFileSystem"

const validPlaylistYaml = `
name: Test Playlist
rules:
  - all:
      - artist:
          includes: "Test Artist"
`

const bareColumnPlaylistYaml = `
name: Bare Rules Playlist
rules:
  - artist:
      includes: "Test Artist"
  - genre:
      is: "pop"
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
		expect(result, "should find both playlists").toHaveLength(2)

		const names = result.map(({ id }) => id as string).sort()
		expect(names, "should match playlist file names").toEqual(["rock", "test"])
	})

	it("should remove deleted playlists from DB on scanAll", async () => {
		const { fileSystem, manager, database } = await createTestManager()
		fileSystem.addPlaylist("test", validPlaylistYaml)
		fileSystem.addPlaylist("rock", anotherPlaylistYaml)

		await manager.scanAll()
		expect(
			(await database.getPlaylists()).getOrThrow(),
			"should have both playlists before deletion"
		).toHaveLength(2)

		fileSystem.removePlaylist("rock")
		await manager.scanAll()

		const playlists = await database.getPlaylists()
		expect(
			playlists.getOrThrow(),
			"should have one playlist after deletion"
		).toHaveLength(1)
		expect(
			playlists.getOrThrow()[0]!.id,
			"should keep the non-deleted playlist"
		).toBe("test" as PlaylistId)
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

		expect(blueprint.isOk(), "should parse successfully").toBe(true)
		const parsed = blueprint.getOrThrow()
		expect(parsed.name, "should have the playlist name").toBe("Test Playlist")
		expect(parsed.rules, "should have one rule").toHaveLength(1)

		const rule = parsed.rules[0]!
		expect(rule._type, "should be an 'all' meta-operator").toBe("all")
		if (!("fields" in rule)) throw new Error("expected MetaOperator")
		expect(rule.fields, "should contain one field matcher").toHaveLength(1)

		expect(
			rule.fields[0],
			"should match artist column with includes"
		).toMatchObject({
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

	it("should parse bare column rules (no all:/any: wrapper)", async () => {
		const { fileSystem, manager } = await createTestManager()
		fileSystem.addPlaylist("bare", bareColumnPlaylistYaml)

		const blueprint = await manager.getBlueprint("bare" as PlaylistId)

		expect(blueprint.isOk(), "should parse successfully").toBe(true)
		const parsed = blueprint.getOrThrow()
		expect(parsed.name, "should have the playlist name").toBe(
			"Bare Rules Playlist"
		)
		expect(parsed.rules, "should have two rules").toHaveLength(2)

		expect(parsed.rules[0], "should match artist with includes").toMatchObject({
			_type: "column",
			column: "artist",
			rules: { includes: "Test Artist", _type: "string" }
		})
		expect(
			parsed.rules[1],
			"should match genre with exact value"
		).toMatchObject({
			_type: "column",
			column: "genre",
			rules: { is: "pop", _type: "string" }
		})
	})

	it("should handle empty playlists directory", async () => {
		const { manager, database } = await createTestManager()

		await manager.scanAll()

		const playlists = await database.getPlaylists()
		expect(playlists.getOrThrow()).toHaveLength(0)
	})
})
