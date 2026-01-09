import path from "node:path"
import json5 from "json5"
import { Result } from "typescript-result"
import untildify from "untildify"
import { z } from "zod"
import { isValidationError, toValidationError } from "zod-validation-error"
import { CONFIG_DIRECTORY } from "#/constants"
import { enumarateError, logg } from "#/logs"
import { iconsSchema } from "./icons"
import { keybindingsSchema } from "./keybindings"
import type { FilePath } from "#/types/types"
import type { BunFile } from "bun"
import type { ValidationError } from "zod-validation-error"

// const trackColumnNames = Object.keys(getTableColumns(tableTracks))

const zFilePath: z.Schema<FilePath> = z.string() as any
export const schemaUrl =
	"https://raw.githubusercontent.com/vdawg-git/moo/refs/heads/master/other/schemas/mooConfig.json"

export const schemaTagType = z.enum(["genre", "mood"])
export type TagType = z.infer<typeof schemaTagType>

export const appConfigSchema = z
	.object({
		$schema: z.string().optional().default(schemaUrl),

		musicDirectories: z
			.array(zFilePath)
			.transform(
				(directories) =>
					directories.map(untildify) as unknown as readonly FilePath[]
			)
			.describe("Directories to recursivly scan music files from."),

		watchDirectories: z
			.boolean()
			.default(true)
			.readonly()
			.describe(
				"Wether to watch the musicDirectories for changes and update the music library then."
			),

		version: z.literal("0.1"),

		/** The icons used by the app. */
		icons: iconsSchema,

		/** All keybindings. Default ones and those overriden by the user. */
		keybindings: keybindingsSchema,

		quickEdit: z
			.object({
				tagSeperator: z
					.string()
					.default("|")
					.describe(
						"The tag used to join a list into a single tag. For example multiple genres for a track are seperated with a '|' by default"
					),
				defaultTagType: schemaTagType.default("mood")
			})
			.describe(
				"Configuration for the 'Quick Edit' feature, which allows you to change the genre/moods of a song on the fly to improve your smart-playlists."
			)
	})
	.strict()
	.readonly()

type Config = Readonly<z.infer<typeof appConfigSchema>>

const defaultConfig: z.input<typeof appConfigSchema> = {
	$schema: schemaUrl,
	musicDirectories: [],
	watchDirectories: true,
	version: "0.1",
	icons: {},
	keybindings: [],
	quickEdit: {}
}

const defaultConfigPath = path.join(CONFIG_DIRECTORY, "config.json5")

async function parseConfig(
	file: BunFile
): Promise<Result<Config, ValidationError | Error>> {
	const config = Result.fromAsyncCatching(json5.parse(await file.text()))
		.map((data) =>
			Result.try(() => appConfigSchema.parse(data)).mapError(
				toValidationError({ prefix: `Failed to parse config. ${file.name}` })
			)
		)
		.mapError((error) =>
			error instanceof Error
				? error
				: (() => {
						const newError = new Error("Parse config error")
						newError.cause = error
						return newError
					})()
		)

	return config
}

async function writeDefaultConfig(): Promise<Result<Config, Error>> {
	return Result.fromAsync(
		Bun.write(defaultConfigPath, json5.stringify(defaultConfig, undefined, 4))
	).map(() => appConfigSchema.parse(defaultConfig))
}

/**
 * Throws on failure.
 *
 * Because we don't want to unwrap everything everywhere where the config is used.
 * Maybe there is a cleaner way, but idk.
 * */
async function getConfig(): Promise<Config> {
	const configFile = Bun.file(defaultConfigPath)

	return Result.fromAsync(configFile.exists())
		.map((isExisting) =>
			isExisting ? parseConfig(configFile) : writeDefaultConfig()
		)
		.getOrElse((error) => {
			console.error(isValidationError(error) ? error.message : error)
			logg.error("Config parse error", enumarateError(error))
			process.exit(1)
		})
}

export const appConfig = await getConfig()
