import { randomUUID } from "node:crypto"
import { extname } from "node:path"
import { $ } from "bun"
import { ensureDirectoryExists } from "#/shared/helpers"
import type { TrackColumnKey } from "#/adapters/sqlite/schema"
import type { TrackId } from "#/ports/database"
import type { FilePath } from "#/shared/types/types"

export async function writeTags({
	id,
	genre,
	mood,
	tagSeparator
}: {
	id: TrackId
	genre?: readonly string[]
	mood?: readonly string[]
	tagSeparator: string
}): Promise<void> {
	if (!genre && !mood) {
		throw new Error("writeTags: No tags passed")
	}

	const genreMeta = genre && toMetadataFlag("genre", genre, tagSeparator)
	const moodMeta = mood && toMetadataFlag("mood", mood, tagSeparator)

	const random = randomUUID()
	const extension = extname(id)
	const tmpPath = `/tmp/moo/${random}.${extension}`

	await ensureDirectoryExists("/tmp/moo" as FilePath)

	const ffmpegCommand = [
		"ffmpeg",
		"-i",
		id,
		"-map",
		0,
		"-y",
		"-codec",
		"copy",
		...(genreMeta ?? []),
		...(moodMeta ?? []),
		"-id3v2_version",
		3,
		tmpPath
	]

	await $`${ffmpegCommand}`.text()

	await $`mv -f ${tmpPath} ${id}`
}

function toMetadataFlag(
	flag: TrackColumnKey,
	data: readonly string[],
	tagSeparator: string
): string[] {
	return [`-metadata`, `${flag}=${data.join(tagSeparator)}`]
}
