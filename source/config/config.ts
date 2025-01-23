import path from "node:path"
import type { BunFile } from "bun"
import { parse as parseJson5, stringify as stringifyJson5 } from "json5"
import { Result } from "typescript-result"
import untildify from "untildify"
import { z } from "zod"
import { CONFIG_DIRECTORY, IS_DEV } from "#/constants"
import type { FilePath } from "#/types/types"
import { iconsSchema } from "./icons"
import { keybindingsSchema } from "./keybindings"

// biome-ignore lint/suspicious/noExplicitAny: .
const zFilePath: z.Schema<FilePath> = z.string() as any
const schema = z
	.object({
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

		/** The icons used by the app. */
		icons: iconsSchema,

		/** All keybindings. Defaults and those overriden by the user. */
		keybindings: keybindingsSchema
	})
	.strict("Unknown properties found in the config!")

type Config = Readonly<z.infer<typeof schema>>

const defaultConfig: Partial<Config> = {
	musicDirectories: [],
	watchDirectories: true
}

const defaultConfigPath = path.join(
	CONFIG_DIRECTORY,
	`${IS_DEV ? "dev_config" : "config"}.json5`
)

async function parseConfig(file: BunFile): Promise<Result<Config, unknown>> {
	const config = Result.fromAsyncCatching(parseJson5(await file.text())).map(
		(data) => Result.try(() => schema.parse(data))
	)

	return config
}

async function writeDefaultConfig(): Promise<Result<Config, Error>> {
	return Result.fromAsync(
		Bun.write(defaultConfigPath, stringifyJson5(defaultConfig, undefined, 4))
	).map(() => schema.parse(defaultConfig))
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
