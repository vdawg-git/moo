#!/usr/bin/env bun
const { startApp } = await import("./start.tsx")

const destroy = await startApp()

process.on("SIGTERM", destroy)
process.on("SIGINT", destroy)
