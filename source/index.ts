#!/usr/bin/env bun
import { startApp } from "./App.tsx"
import {} from "@drizzle-team/brocli"

process.on("uncaughtException", (error) => {
	console.error(error)
	process.exit(1)
})

startApp()
