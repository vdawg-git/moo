import { createCliRenderer } from "@opentui/core"
import type { CliRenderer } from "@opentui/core"

/**
 * Do not import this outside of TUI code.
 * Creating the renderer has side-effects like switching to the alternative buffer,
 * attaching process.exit events etc.
 * And this causes hard to debug bugs.
 *
 * Instead, if you need the renderer for some non-tui code, pass it down.
 */
export const renderer: CliRenderer = await createCliRenderer()
