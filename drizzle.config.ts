import { defineConfig } from "drizzle-kit"
import { databasePath, IS_DEV } from "#/constants"

console.log({ IS_DEV, databasePath })

// biome-ignore lint/style/noDefaultExport: Drizzle needs that
export default defineConfig({
	out: "./drizzle",
	schema: "./source/database/schema.ts",
	dialect: "sqlite",
	dbCredentials: {
		url: databasePath
	}
})
