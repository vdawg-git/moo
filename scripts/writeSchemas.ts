import { appConfigSchema } from "#/config/config"
import { playlistSchema } from "#/smartPlaylists/schema"
import path from "node:path"
import { zodToJsonSchema, ignoreOverride } from "zod-to-json-schema"
import type { z, ZodSchema } from "zod"

const schemas = [
	["mooConfig.json", appConfigSchema],
	["mooPlaylist.json", playlistSchema]
] as const

await Promise.all(schemas.map(([name, schema]) => writeSchema(name, schema)))

process.exit(0)

async function writeSchema(name: string, schema: ZodSchema<unknown>) {
	const jsonSchema = zodToJsonSchema(schema, {
		override: (defs, refs) => {
			const current = refs.currentPath.at(-1)

			if (current === "_type") return undefined

			return ignoreOverride
		}
	})

	return Bun.write(
		path.join(process.cwd(), "dist/schemas/", name),
		JSON.stringify(jsonSchema, null, 2)
	)
}
