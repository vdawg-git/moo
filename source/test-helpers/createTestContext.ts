import { EMPTY } from "rxjs"
import { createMemoryDatabase } from "#/adapters/sqlite/createMemoryDatabase"
import { createAppContext } from "#/app/context"
import { KeybindTrie } from "#/application/keybinds/keybindsState"
import { appConfigSchema } from "#/shared/config/config"
import { createMockPlayer } from "./mockPlayer"
import { createTestFileSystem } from "./testFileSystem"
import type { AppContext } from "#/app/context"
import type { AppDatabase } from "#/ports/database"
import type { AppConfig } from "#/shared/config/config"
import type { FilePath } from "#/shared/types/types"
import type { TestFileSystem } from "./testFileSystem"

const testConfig: AppConfig = appConfigSchema.parse({
	musicDirectories: [],
	version: "0.1",
	icons: {},
	keybindings: [],
	quickEdit: {}
})

export type TestContext = AppContext & {
	readonly mockPlayer: ReturnType<typeof createMockPlayer>
	readonly testFileSystem: TestFileSystem
}

/** Creates an isolated test context with in-memory DB, mock player, and test filesystem */
export async function createTestContext(options?: {
	readonly database?: AppDatabase
	readonly fileSystem?: TestFileSystem
	readonly musicDirectories?: readonly FilePath[]
	readonly playlistsDirectory?: FilePath
}): Promise<TestContext> {
	const database = options?.database ?? (await createMemoryDatabase())
	const mockPlayer = createMockPlayer()
	const testFileSystem = options?.fileSystem ?? createTestFileSystem()

	const context = createAppContext({
		config: testConfig,
		database,
		fileSystem: testFileSystem,
		player: mockPlayer,
		keybindManagerDeps: {
			keybindsState: new KeybindTrie(),
			keys$: EMPTY
		}
	})

	return {
		...context,
		mockPlayer,
		testFileSystem
	}
}
