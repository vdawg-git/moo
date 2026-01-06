import { randomUUID } from "node:crypto"
import { extname } from "node:path"
import { $ } from "bun"
import { appConfig } from "#/config/config"
import { ensureDirectoryExists } from "#/filesystem"
import type { TrackColumnKey } from "#/database/schema"
import type { TrackId } from "#/database/types"
import type { FilePath } from "#/types/types"

export async function writeTags({
	id,
	genre,
	mood
}: {
	id: TrackId
	genre?: readonly string[]
	mood?: readonly string[]
}): Promise<void> {
	if (!genre && !mood) {
		throw new Error("writeTags: No tags passed")
	}

	const genreMeta = genre && toMetadataFlag("genre", genre)
	const moodMeta = mood && toMetadataFlag("mood", mood)

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
	data: readonly string[]
): string[] {
	return [`-metadata`, `${flag}=${data.join(appConfig.quickEdit.tagSeperator)}`]
}

await writeTags({
	id: "/home/vdawg/z_bearbeiten/Raflum - Gui Zhao (2021) [FLAC] [16B-44.1kHz]/03. Raflum - A Night Far Away.flac" as TrackId,
	mood: ["solemn", "chill"]
})
	.catch(console.error)
	.then(console.log)
