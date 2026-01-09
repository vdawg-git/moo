import { defineConfig } from "drizzle-kit"
import { databasePath, IS_DEV } from "#/constants"

console.log({ IS_DEV, databasePath })

export default defineConfig({
	out: "./drizzle",
	schema: "./source/database/schema.ts",
	dialect: "sqlite",
	dbCredentials: {
		url: databasePath
	}
})
