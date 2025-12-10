import path from "node:path"
import { type ZodType, z } from "zod"
import { appConfigSchema } from "#/config/config"
import { appThemeSchema } from "#/config/theme"
import { APP_ROOT } from "#/constants"
import { playlistBlueprintSchema } from "#/smartPlaylists/schema"

const schemas = [
	["mooConfig.json", appConfigSchema],
	["theme.json", appThemeSchema],
	["mooPlaylist.json", playlistBlueprintSchema]
] as const

await Promise.all(schemas.map(([name, schema]) => writeSchema(name, schema)))

process.exit(0)

async function writeSchema(name: string, schema: ZodType<unknown>) {
	const jsonSchema = z.toJSONSchema(schema, {
		io: "input",
		reused: "ref",
		// VS Code does not fully support the latest target, so we use an old one
		target: "draft-4",
		override: (ctx) => {
			// overriding _type directly is not possible. It needs to get deleted from the parent
			if (ctx.jsonSchema.properties?._type) {
				delete ctx.jsonSchema.properties._type
			}

			if (ctx.jsonSchema.type === "object") {
				ctx.jsonSchema.additionalProperties = false
			}
		}
	})

	return Bun.write(
		path.join(APP_ROOT, "other/schemas/", name),
		JSON.stringify(jsonSchema, null, 2)
	)
}
