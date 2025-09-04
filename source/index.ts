#!/usr/bin/env bun
import { setupFiles } from "./filesystem.ts"
import { enumarateError, logg } from "./logs.ts"

await setupFiles()

process.on("uncaughtException", (error) => {
	logg.error("uncaughtException", enumarateError(error))

	// idk why this never prints
	console.error(error.stack || error.message)
})

const { startApp } = await import("./start.tsx")

startApp()
