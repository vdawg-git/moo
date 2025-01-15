import { databasePath } from "#/constants"
import { defineConfig } from "drizzle-kit"

// biome-ignore lint/style/noDefaultExport: <explanation>
export default defineConfig({
	out: "./drizzle",
	schema: "./source/database/schema.ts",
	dialect: "sqlite",
	dbCredentials: {
		url: databasePath
	}
})
