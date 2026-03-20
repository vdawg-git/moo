import { EMPTY } from "rxjs"
import { createAppContext } from "#/appContext"
import { appConfigSchema } from "#/config/config"
import { createMemoryDatabase } from "#/database/createMemoryDatabase"
import { KeybindTrie } from "#/keybindManager/keybindsState"
import { createMockPlayer } from "./mockPlayer"
import type { AppContext } from "#/appContext"
import type { AppConfig } from "#/config/config"
import type { AppDatabase } from "#/database/types"

const testConfig: AppConfig = appConfigSchema.parse({
	musicDirectories: [],
	version: "0.1",
	icons: {},
	keybindings: [],
	quickEdit: {}
})

export type TestContext = AppContext & {
	readonly mockPlayer: ReturnType<typeof createMockPlayer>
	readonly destroy: () => void
}

/** Creates an isolated test context with in-memory DB and mock player */
export async function createTestContext(options?: {
	readonly database?: AppDatabase
}): Promise<TestContext> {
	const database = options?.database ?? (await createMemoryDatabase())
	const mockPlayer = createMockPlayer()

	const context = createAppContext({
		config: testConfig,
		database,
		player: mockPlayer,
		keybindManagerDeps: {
			keybindsState: new KeybindTrie(),
			keys$: EMPTY
		}
	})

	return {
		...context,
		mockPlayer,
		destroy: () => {}
	}
}
