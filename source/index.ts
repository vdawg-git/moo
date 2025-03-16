#!/usr/bin/env bun
import { setupFiles } from "./filesystem.ts"
// import {} from "@drizzle-team/brocli"

await setupFiles()

process.on("uncaughtException", (error) => {
	console.error(error)
	process.exit(1)
})

const { startApp } = await import("./start.tsx")

startApp()
