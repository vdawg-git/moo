// Test setup file to mock dependencies

import { mock } from "bun:test"
import { createMockLogger } from "#/test-helpers/mockLogger"
import type * as ConstantsModule from "#/shared/constants"
import type * as LoggerModule from "#/shared/logs"
import type { FilePath } from "#/shared/types/types"

await mock.module(
	"#/shared/constants",
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
await mock.module(
	"#/shared/logs",
	() =>
		({
			logger: mockLogger
		}) satisfies typeof LoggerModule
)
