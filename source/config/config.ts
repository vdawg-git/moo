import path from "node:path"
import type { BunFile } from "bun"
import json5 from "json5"
import { Result } from "typescript-result"
import untildify from "untildify"
import { z } from "zod"
import { CONFIG_DIRECTORY, IS_DEV } from "#/constants"
import type { FilePath } from "#/types/types"
import { iconsSchema } from "./icons"
import { keybindingsSchema } from "./keybindings"

// biome-ignore lint/suspicious/noExplicitAny: .
const zFilePath: z.Schema<FilePath> = z.string() as any
const schemaUrl =
	"https://raw.githubusercontent.com/vdawg-git/moo/refs/heads/main/other/schemas/mooConfig.json"

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

		/** All keybindings. Defaults and those overriden by the user. */
		keybindings: keybindingsSchema
	})
	.strict("Unknown properties found in the config!")

type Config = Readonly<z.infer<typeof appConfigSchema>>

const defaultConfig: Partial<Config> = {
	$schema: schemaUrl,
	musicDirectories: [],
	watchDirectories: true,
	version: "0.1"
}

const defaultConfigPath = path.join(CONFIG_DIRECTORY, "config.json5")

async function parseConfig(file: BunFile): Promise<Result<Config, unknown>> {
	const config = Result.fromAsyncCatching(json5.parse(await file.text())).map(
		(data) => Result.try(() => appConfigSchema.parse(data))
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
		.getOrThrow()
}

export const appConfig = await getConfig()
