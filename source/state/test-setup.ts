// Test setup file to mock dependencies

import { vi } from "bun:test"

// Mock config to prevent file loading
await vi.module("#/config/config", () => ({
	config: {
		musicDirectories: [],
		keybindings: {},
		theme: {},
		icons: {}
	},
	loadConfig: vi.fn(),
	getConfig: vi.fn(() => ({ musicDirectories: [] }))
}))

// Mock constants to prevent config loading
await vi.module("#/constants", () => ({
	IS_DEV: true,
	APP_NAME: "moo_test",
	CONFIG_DIRECTORY: "/tmp/test",
	DATA_DIRECTORY: "/tmp/test"
}))

// Mock logs
await vi.module("#/logs", () => ({
	logg: {
		debug: console.log,
		error: console.error,
		info: console.log,
		warn: console.warn
	},
	enumarateError: vi.fn((error: any) => ({ error }))
}))

// Mock addErrorNotification to avoid circular dependency
// vi.module("./state", async (importOriginal) => {
// 	const original = await (importOriginal as any)()
// 	return {
// 		...(original as any),
// 		addErrorNotification: vi.fn()
// 	}
// })
