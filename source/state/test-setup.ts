// Test setup file to mock dependencies

import { vi } from "bun:test"
import * as ConstantsModule from "#/constants"
import * as LoggerModule from "#/logs"
import { createMockLogger } from "#/testing/mockLogger"
import type { FilePath } from "#/types/types"

// Mock constants to prevent config loading
await vi.module(
	"#/constants",
	() =>
		({
			IS_DEV: true,
			APP_NAME: "moo_test",
			CONFIG_DIRECTORY: "/tmp/test" as FilePath,
			DATA_DIRECTORY: "/tmp/test" as FilePath,
			APP_ROOT: "/tmp/test/2",
			databasePath: "/tmp/test/1" as FilePath,
			LOGS_DIRECTORY: "/tmp/test/3" as FilePath,
			playlistExtension: ".yml",
			playlistsDirectory: "/tmp/test/4" as FilePath,
			TEMP_DIRECTORY: "/tmp/test/6" as FilePath
		}) satisfies typeof ConstantsModule
)

const mockLogger = createMockLogger()

// Mock logs module — shape matches what consumer code imports
await vi.module(
	"#/logs",
	() =>
		({
			logger: mockLogger
		}) satisfies typeof LoggerModule
)
