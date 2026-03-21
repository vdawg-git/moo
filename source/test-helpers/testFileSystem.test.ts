import { describe, expect, it } from "bun:test"
import { firstValueFrom, take, toArray } from "rxjs"
import { createTestFileSystem } from "#/test-helpers/testFileSystem"
import type { FilePath } from "#/shared/types/types"

describe("createTestFileSystem", () => {
	describe("readFile", () => {
		it("should read back binary content that was set", async () => {
			const fileSystem = createTestFileSystem()
			const content = new Uint8Array([1, 2, 3])
			fileSystem.setFile("/test.bin", content)

			const result = await fileSystem.readFile("/test.bin" as FilePath)

			expect(result).toEqual(content)
		})

		it("should read back string content as Uint8Array", async () => {
			const fileSystem = createTestFileSystem()
			fileSystem.setFile("/test.txt", "hello")

			const result = await fileSystem.readFile("/test.txt" as FilePath)

			expect(result).toEqual(new TextEncoder().encode("hello"))
		})

		it("should throw on missing file", async () => {
			const fileSystem = createTestFileSystem()

			expect(fileSystem.readFile("/missing" as FilePath)).rejects.toThrow(
				"ENOENT"
			)
		})
	})

	describe("readTextFile", () => {
		it("should read back string content", async () => {
			const fileSystem = createTestFileSystem()
			fileSystem.setFile("/test.txt", "hello world")

			const result = await fileSystem.readTextFile("/test.txt" as FilePath)

			expect(result).toBe("hello world")
		})

		it("should decode binary content as UTF-8", async () => {
			const fileSystem = createTestFileSystem()
			fileSystem.setFile("/test.txt", new TextEncoder().encode("bytes"))

			const result = await fileSystem.readTextFile("/test.txt" as FilePath)

			expect(result).toBe("bytes")
		})

		it("should throw on missing file", async () => {
			const fileSystem = createTestFileSystem()

			expect(fileSystem.readTextFile("/missing" as FilePath)).rejects.toThrow(
				"ENOENT"
			)
		})
	})

	describe("readdir", () => {
		it("should list direct children of a directory", async () => {
			const fileSystem = createTestFileSystem()
			fileSystem.setFile("/dir/a.txt", "a")
			fileSystem.setFile("/dir/b.txt", "b")
			fileSystem.setFile("/dir/sub/c.txt", "c")

			const result = await fileSystem.readdir("/dir" as FilePath)

			expect(result).toEqual(["a.txt", "b.txt"])
		})

		it("should include nested files when recursive is true", async () => {
			const fileSystem = createTestFileSystem()
			fileSystem.setFile("/dir/a.txt", "a")
			fileSystem.setFile("/dir/sub/b.txt", "b")
			fileSystem.setFile("/dir/sub/deep/c.txt", "c")

			const result = await fileSystem.readdir("/dir" as FilePath, {
				recursive: true
			})

			expect(result).toEqual(["a.txt", "sub/b.txt", "sub/deep/c.txt"])
		})

		it("should return empty array for empty directory", async () => {
			const fileSystem = createTestFileSystem()

			const result = await fileSystem.readdir("/empty" as FilePath)

			expect(result).toEqual([])
		})

		it("should handle trailing slash in directory path", async () => {
			const fileSystem = createTestFileSystem()
			fileSystem.setFile("/dir/a.txt", "a")

			const result = await fileSystem.readdir("/dir/" as FilePath)

			expect(result).toEqual(["a.txt"])
		})
	})

	describe("stat", () => {
		it("should return size and mtime", async () => {
			const fileSystem = createTestFileSystem()
			const mtime = new Date("2025-01-01")
			fileSystem.setFile("/test.txt", "hello", { mtime })

			const result = await fileSystem.stat("/test.txt" as FilePath)

			expect(result.size).toBe(5)
			expect(result.mtime).toEqual(mtime)
		})

		it("should throw on missing file", async () => {
			const fileSystem = createTestFileSystem()

			expect(fileSystem.stat("/missing" as FilePath)).rejects.toThrow("ENOENT")
		})
	})

	describe("writeFile", () => {
		it("should store content readable via readTextFile", async () => {
			const fileSystem = createTestFileSystem()
			await fileSystem.writeFile("/test.txt" as FilePath, "written")

			const result = await fileSystem.readTextFile("/test.txt" as FilePath)

			expect(result).toBe("written")
		})

		it("should emit 'add' event for new file", async () => {
			const fileSystem = createTestFileSystem()
			const eventPromise = firstValueFrom(fileSystem.watch("/").pipe(take(1)))

			await fileSystem.writeFile("/test.txt" as FilePath, "data")
			const event = await eventPromise

			expect(event.event).toBe("add")
			expect(event.filePath).toBe("/test.txt" as FilePath)
		})

		it("should emit 'change' event for existing file", async () => {
			const fileSystem = createTestFileSystem()
			await fileSystem.writeFile("/test.txt" as FilePath, "first")

			const eventPromise = firstValueFrom(fileSystem.watch("/").pipe(take(1)))
			await fileSystem.writeFile("/test.txt" as FilePath, "second")
			const event = await eventPromise

			expect(event.event).toBe("change")
		})
	})

	describe("exists", () => {
		it("should return true for existing file", async () => {
			const fileSystem = createTestFileSystem()
			fileSystem.setFile("/test.txt", "data")

			expect(await fileSystem.exists("/test.txt" as FilePath)).toBe(true)
		})

		it("should return false for missing file", async () => {
			const fileSystem = createTestFileSystem()

			expect(await fileSystem.exists("/missing" as FilePath)).toBe(false)
		})
	})

	describe("watch", () => {
		it("should only emit events for files under the watched path", async () => {
			const fileSystem = createTestFileSystem()
			const events = firstValueFrom(
				fileSystem.watch("/watched").pipe(take(1), toArray())
			)

			fileSystem.setFile("/other/file.txt", "ignored")
			fileSystem.setFile("/watched/file.txt", "included")
			const result = await events

			expect(result).toHaveLength(1)
			expect(result[0]!.filePath).toBe("/watched/file.txt" as FilePath)
		})

		it("should respect the ignored option", async () => {
			const fileSystem = createTestFileSystem()
			const events = firstValueFrom(
				fileSystem
					.watch("/dir", {
						ignored: (filePath) => filePath.endsWith(".tmp")
					})
					.pipe(take(1), toArray())
			)

			fileSystem.setFile("/dir/skip.tmp", "ignored")
			fileSystem.setFile("/dir/keep.txt", "included")
			const result = await events

			expect(result).toHaveLength(1)
			expect(result[0]!.filePath).toBe("/dir/keep.txt" as FilePath)
		})
	})

	describe("setFile", () => {
		it("should store content with custom mtime", async () => {
			const fileSystem = createTestFileSystem()
			const mtime = new Date("2024-06-15")
			fileSystem.setFile("/file.txt", "content", { mtime })

			const stat = await fileSystem.stat("/file.txt" as FilePath)

			expect(stat.mtime).toEqual(mtime)
		})

		it("should emit 'add' for new file and 'change' for update", async () => {
			const fileSystem = createTestFileSystem()
			const events = firstValueFrom(
				fileSystem.watch("/").pipe(take(2), toArray())
			)

			fileSystem.setFile("/file.txt", "first")
			fileSystem.setFile("/file.txt", "second")
			const result = await events

			expect(result[0]!.event).toBe("add")
			expect(result[1]!.event).toBe("change")
		})
	})

	describe("removeFile", () => {
		it("should delete the file so it no longer exists", async () => {
			const fileSystem = createTestFileSystem()
			fileSystem.setFile("/file.txt", "data")

			fileSystem.removeFile("/file.txt")

			expect(await fileSystem.exists("/file.txt" as FilePath)).toBe(false)
		})

		it("should emit 'unlink' event", async () => {
			const fileSystem = createTestFileSystem()
			fileSystem.setFile("/file.txt", "data")

			const eventPromise = firstValueFrom(fileSystem.watch("/").pipe(take(1)))
			fileSystem.removeFile("/file.txt")
			const event = await eventPromise

			expect(event.event).toBe("unlink")
			expect(event.filePath).toBe("/file.txt" as FilePath)
		})
	})

	describe("addTrack", () => {
		it("should add a track under /music by default", async () => {
			const fileSystem = createTestFileSystem()

			fileSystem.addTrack("song.flac")

			expect(await fileSystem.exists("/music/song.flac" as FilePath)).toBe(true)
		})

		it("should add a track under a custom directory", async () => {
			const fileSystem = createTestFileSystem()

			fileSystem.addTrack("song.flac", { directory: "/other" })

			expect(await fileSystem.exists("/other/song.flac" as FilePath)).toBe(true)
		})

		it("should encode metadata as JSON when provided", async () => {
			const fileSystem = createTestFileSystem()
			const metadata = { title: "My Song", artist: "Artist" }

			fileSystem.addTrack("song.flac", { metadata })

			const content = await fileSystem.readTextFile(
				"/music/song.flac" as FilePath
			)
			expect(JSON.parse(content)).toEqual(metadata)
		})

		it("should store dummy bytes when no metadata is provided", async () => {
			const fileSystem = createTestFileSystem()

			fileSystem.addTrack("song.flac")

			const content = await fileSystem.readFile("/music/song.flac" as FilePath)
			expect(content).toEqual(new Uint8Array([1]))
		})
	})

	describe("addPlaylist", () => {
		it("should add a playlist under /playlists by default with .yml extension", async () => {
			const fileSystem = createTestFileSystem()

			fileSystem.addPlaylist("rock", "name: Rock")

			const content = await fileSystem.readTextFile(
				"/playlists/rock.yml" as FilePath
			)
			expect(content).toBe("name: Rock")
		})

		it("should add a playlist under a custom directory", async () => {
			const fileSystem = createTestFileSystem()

			fileSystem.addPlaylist("rock", "name: Rock", {
				directory: "/custom"
			})

			expect(await fileSystem.exists("/custom/rock.yml" as FilePath)).toBe(true)
		})
	})
})
