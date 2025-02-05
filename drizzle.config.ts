import { databasePath } from "#/constants"
import { defineConfig } from "drizzle-kit"

// biome-ignore lint/style/noDefaultExport: Drizzle needs that
export default defineConfig({
	out: "./drizzle",
	schema: "./source/database/schema.ts",
	dialect: "sqlite",
	dbCredentials: {
		url: databasePath
	}
})
