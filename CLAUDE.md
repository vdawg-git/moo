## Project

Moo is a terminal music player built with TypeScript, Bun, React 19, and OpenTUI.

## Tech Stack

Bun runtime, React 19 + OpenTUI (TUI rendering), Drizzle ORM + SQLite, XState store, RxJS, MPV (audio playback via IPC socket), MPRIS (media keys), ts-pattern, Remeda, Zod.

## Commands

- `bun dev` — run with watch
- `bun prod` — production run
- `bun compile` — build binary
- `bun types` — typecheck
- `bun lint` / `bun lint:fix` — oxlint
- `bun format` — prettier
- `bun db:generate` — regenerate Drizzle SQL migrations

## External Runtime Dependencies

- **MPV** — audio playback via IPC socket
- **FFmpeg** — tag writing
- **Nerd Font** terminal

## Key Paths

- Entry: `source/index.ts` → `source/start.tsx` → `source/App.tsx`
- State: `source/state/state.ts`
- DB: `source/database/database.ts`, `source/database/schema.ts`
- Player: `source/player/mpv.ts`
- Smart playlists: `source/smartPlaylists/`
- Config: `~/.config/moo/`, Data: `~/.local/share/moo/`, Cache: `~/.cache/moo/`

## Tech Rules

- Never use abbreviations or single-letter variable names
- Always put a linebreak before the final return
- Early returns should have a line-break after them
- Noun-first naming, fixed order: **`<Entity><Part><Variant>`**. Use only the minimum words needed.
  Examples: `ImagePreview`, `ImagePreviewLarge`, `NodeSocketInput`, `AudioBandBass`
- Functions start with a verb: `createNode`, `getConnection`, `connectSocket`
- Main exports at the top of the file, implementation details below — readers see the API first (write a comment after them to prevent the linter from sorting them down)
- Keep functions short and focused — extract complex operators into named functions
- Add a brief `/** ... */` doc comment to non-trivial functions (5+ lines or non-obvious purpose)

**TypeScript**

- `const` only — no `let`. Use declarative expressions; `ts-pattern` for conditional assignments
- `type` over `interface` — never `any`
- Prefer `readonly` on types
- Discriminated unions over type assertions — make illegal states unrepresentable
- Use `satisfies` for type-safe object literals without widening
- Explicit return types on exported functions (except React components)
- Assert types, throw on failure — no coalescing fallbacks for type narrowing
- `undefined` over `null` for unset values
- `??` over `||`
- `function` keyword for components and longer functions, arrow functions for callbacks and inline helpers
- Named exports over default exports
- Reference existing types — never duplicate type literals
- No `else` — use early returns, ternaries, or `ts-pattern`
- Prefer `ts-pattern` `match()` over `switch` and `if-else` chains — especially in JSX
- Exhaustive checks with `never` in match/if chains
- Prefer Remeda (`pipe`, `entries`, `filter`, `map`, `fromEntries`) for multi-step collection transforms — cleaner than nested `Object.fromEntries(Object.entries(...)...)`
- Prefer declarative collection operations over imperative loops
- Prefer `pipe` + `O.maybe` (`source/lib/option.ts`) over manual null-check chains — chain optional lookups declaratively instead of nesting `if (x) { if (x.y) { ... } }`
- If a function takes more than two arguments you should use an object as an argument and not positional arguments
- Use named tuple elements in array types (e.g., `[red: number, green: number]` not `[number, number]`)

**RxJS / Observables**

- Observables should be hot by default — use `.shareReplay(1)` for shared subscriptions
- Keep RxJS streams declarative — avoid `state$.next()` side effects mid-pipeline, use derived state from the stream output (use tap(next()) as a last resort)

**React**

- Components are pure renderers — logic lives in Redux slices or hooks
- Functional components only, no class components
- Custom hooks for reusable logic, keep components thin
- No `useMemo`/`useCallback` — React 19 handles memoization
- No `forwardRef` — React 19 passes `ref` as a regular prop
- Props should be generic (callbacks, primitives) — avoid passing store types or domain models into leaf components
- Extract non-trivial event handlers into named functions
- Colocate feature code: slice + components + hooks in same feature folder

## Testability & Dependency Injection

- **No module-level singletons** — don't initialize state at module scope. Use React Context providers or factory functions with injected dependencies
- **Systems use constructor injection** — `createFoo(deps)` pattern. Provide dependencies via React Context, not module imports
- **Systems must be destroyable** — every system returns a `destroy()` for cleanup (tests, HMR, unmount)
- **Side effects must be explicit and cancelable** — no fire-and-forget inits. Use Observable subscriptions or cleanup functions that can be torn down
- **Decouple creation from wiring** — factory functions create systems, a provider wires them together. Tests can wire differently

## Core Principles

Pure functions, immutability, composition over inheritance, single responsibility, explicit errors, type-driven design, make illegal states unrepresentable, dependency injection, optimize for deletion and debugging, push complexity to edges, readable code over clever code.

## Don'ts

- Don't use `any` — use `unknown` and narrow
- Don't use `enum` — use `as const` objects or discriminated unions
- Don't put business logic in components — use slices, thunks, or hooks
- Don't use `switch` or `if-else` chains — use `ts-pattern` `match()` instead
- Don't use `else` — early return, ternary, or `match()`
- Don't use `let` — use `const` with declarative expressions
- Don't use imperative loops for collection transforms — use declarative `.filter`/`.map`/`Object.fromEntries`
- Don't use nested `if` chains for optional property access — use `pipe` + `O.maybe` to express the same thing declaratively
- Dont put business logic into React Components. The Rendering Layer shouldn't be coupled to business logic.
