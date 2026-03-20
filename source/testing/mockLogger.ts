import { vi } from "bun:test"
import type { AppLogger } from "#/logs"

/** Creates a mock logger with all methods as vi.fn() */
export function createMockLogger(): AppLogger {
	return {
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn()
	}
}
