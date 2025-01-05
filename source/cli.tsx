#!/usr/bin/env bun
import meow from "meow"
import { startApp } from "./App.tsx"
import process from "node:process"

process.stdin.resume()

const cli = meow(
	`
	Usage
	  $ my-ink-cli

	Options
		--name  Your name

	Examples
	  $ my-ink-cli --name=Jane
	  Hello, Jane
`,
	{
		importMeta: import.meta,
		flags: {
			name: {
				type: "string",
			},
		},
	},
)

startApp()
