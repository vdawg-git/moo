import { CONFIG_DIRECTORY, IS_DEV } from "#/constants"
import path from "node:path"
import { Result } from "typescript-result"
import { z } from "zod"
import { parse as parseJson5, stringify as stringifyJson5 } from "json5"
import type { BunFile } from "bun"
import type { FilePath } from "#/types/types"

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const zFilePath: z.Schema<FilePath> = z.string() as any
const schema = z.object({
	musicDirectories: z.array(zFilePath).default([]),
	watchDirectories: z.boolean().default(true),
})

type Config = Readonly<z.infer<typeof schema>>

const defaultConfig: Config = {
	musicDirectories: [],
	watchDirectories: true,
}

const defaultConfigPath = path.join(
	CONFIG_DIRECTORY,
	`${IS_DEV ? "dev_config" : "config"}.json5`,
)

async function parseConfig(file: BunFile): Promise<Result<Config, unknown>> {
	const config = Result.fromAsyncCatching(parseJson5(await file.text())).map(
		(data) => Result.try(() => schema.parse(data)),
	)

	return config
}

async function writeDefaultConfig(): Promise<Result<Config, Error>> {
	return Result.fromAsync(
		Bun.write(defaultConfigPath, stringifyJson5(defaultConfig, undefined, 4)),
	).map(() => defaultConfig)
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
			isExisting ? parseConfig(configFile) : writeDefaultConfig(),
		)
		.getOrThrow()
}

export const config = await getConfig()
