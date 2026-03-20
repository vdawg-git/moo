import { readFile } from "node:fs/promises"
import path from "node:path"
import { Result } from "typescript-result"
import * as yaml from "yaml"
import { fromError } from "zod-validation-error"
import { playlistExtension, playlistsDirectory } from "#/constants"
import { playlistBlueprintSchema } from "./schema"
import type { PlaylistId } from "#/database/types"
import type { FilePath } from "#/types/types"
import type { AsyncResult } from "typescript-result"
import type { PlaylistBlueprint } from "./schema"

/**
 * Get a playlist blueprint by its ID (reads from real filesystem).
 * Used by the database for on-demand playlist resolution.
 */
export function getPlaylistBlueprintFromId(
	id: PlaylistId
): AsyncResult<PlaylistBlueprint, Error> {
	return parsePlaylistBlueprintFromPath(playlistIdToFilePath(id))
}

function playlistIdToFilePath(id: PlaylistId): FilePath {
	return path.join(playlistsDirectory, id + playlistExtension) as FilePath
}

export function parsePlaylistBlueprintFromPath(
	filePath: FilePath
): AsyncResult<PlaylistBlueprint, Error> {
	return Result.fromAsyncCatching(readFile(filePath, "utf-8"))
		.map((text) => yaml.parse(text))
		.map((toParse) =>
			playlistBlueprintSchema
				.parseAsync(toParse)
				.catch((error) => Result.error(fromError(error)))
		)
		.mapError((error) =>
			error instanceof Error
				? error
				: new Error(`Error parsing file: ${filePath}`, { cause: error })
		)
}
