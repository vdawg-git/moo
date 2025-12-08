// Test setup file to mock dependencies

import { vi } from "vitest"

// Mock config to prevent file loading
vi.mock("#/config/config", () => ({
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
vi.mock("#/constants", () => ({
	IS_DEV: true,
	APP_NAME: "moo_test",
	CONFIG_DIRECTORY: "/tmp/test",
	DATA_DIRECTORY: "/tmp/test"
}))

// Mock logs
vi.mock("#/logs", () => ({
	logg: {
		debug: console.log,
		error: console.error,
		info: console.log,
		warn: console.warn
	},
	enumarateError: vi.fn((error: any) => ({ error }))
}))

// Mock addErrorNotification to avoid circular dependency
// vi.mock("./state", async (importOriginal) => {
// 	const original = await (importOriginal as any)()
// 	return {
// 		...(original as any),
// 		addErrorNotification: vi.fn()
// 	}
// })
