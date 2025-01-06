import { APP_NAME, IS_DEV } from "#/constants"
import path from "node:path"
import os from "node:os"
import { Result } from "typescript-result"
import { z } from "zod"
import { parse, stringify } from "json5"

const schema = z.object({
	musicDirectories: z.array(z.string()),
})

type Config = Readonly<z.infer<typeof schema>>

const defaultConfig: Config = {
	musicDirectories: [],
}

const defaultConfigPath = path.join(
	os.homedir(),
	`.config/${APP_NAME}/${IS_DEV ? "dev_config" : "config"}.toml`,
)

export async function readConfig(): Promise<Result<Config, Error>> {
	const config = Result.try(() => parse(defaultConfigPath)).map((data) =>
		Result.try(() => schema.parse(data)),
	)
	// how to nicely ensurue that the config is valid?
	// that means that requried keys should exist and that all keys are of the correct type
	// zod might make sense here
	return config
}

export async function writeDefaultConfig(): Promise<Result<Config, Error>> {
	return Result.fromAsync(
		Bun.write(defaultConfigPath, stringify(defaultConfig)),
	).map(() => defaultConfig)
}
