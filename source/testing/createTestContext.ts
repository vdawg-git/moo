import { EMPTY } from "rxjs"
import { createAppContext } from "#/appContext"
import { appConfigSchema } from "#/config/config"
import { createMemoryDatabase } from "#/database/createMemoryDatabase"
import { KeybindTrie } from "#/keybindManager/keybindsState"
import { createMockPlayer } from "./mockPlayer"
import { createTestFileSystem } from "./testFileSystem"
import type { AppContext } from "#/appContext"
import type { AppConfig } from "#/config/config"
import type { AppDatabase } from "#/database/types"
import type { FilePath } from "#/types/types"
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
