#!/usr/bin/env bun
import { startApp } from "./App.tsx"
import process from "node:process"
import {} from "@drizzle-team/brocli"

process.stdin.resume()

startApp()
