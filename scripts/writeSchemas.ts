import path from "node:path"
import type { ZodSchema } from "zod"
import { ignoreOverride, zodToJsonSchema } from "zod-to-json-schema"
import { appConfigSchema } from "#/config/config"
import { APP_ROOT } from "#/constants"
import { playlistBlueprintSchema } from "#/smartPlaylists/schema"

const schemas = [
	["mooConfig.json", appConfigSchema],
	["mooPlaylist.json", playlistBlueprintSchema]
] as const

await Promise.all(schemas.map(([name, schema]) => writeSchema(name, schema)))

process.exit(0)

async function writeSchema(name: string, schema: ZodSchema<unknown>) {
	const jsonSchema = zodToJsonSchema(schema, {
		pipeStrategy: "input",
		$refStrategy: "root",
		override: (defs, refs) => {
			const current = refs.currentPath.at(-1)

			// removes the identifier which is only used for Typescript
			if (current === "_type") return undefined

			return ignoreOverride
		}
	})

	return Bun.write(
		path.join(APP_ROOT, "other/schemas/", name),
		JSON.stringify(jsonSchema, null, 2)
	)
}
