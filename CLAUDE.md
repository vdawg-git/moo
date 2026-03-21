## Project

Moo is a terminal music player built with TypeScript, Bun, React 19, and OpenTUI.

## Tech Stack

Bun runtime, React 19 + OpenTUI (TUI rendering), Drizzle ORM + SQLite, XState store + mutative (immutable updates with mutable syntax), RxJS, MPV (audio playback via IPC socket), MPRIS (media keys), ts-pattern, Remeda, typescript-result, Zod.

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

## Architecture

Ports & Adapters (Hexagonal). **The one rule:** Core never imports infrastructure. Dependencies point inward.

| Layer | Purpose | Can import from |
|---|---|---|
| `core/` | Pure state + reducers, command defs, playlist DSL schema | `core/`, `shared/` |
| `ports/` | Interfaces (Player, AppDatabase, AppFileSystem) | `ports/`, `shared/` |
| `adapters/` | Implementations (MPV, SQLite, filesystem) | `ports/`, `shared/` |
| `application/` | Use cases, orchestration | `core/`, `ports/`, `application/`, `shared/` |
| `ui/` | React components + hooks | `core/` (types), `ports/` (types), `app/` (context), `ui/`, `shared/` |
| `app/` | Composition root, wiring | everything |
| `shared/` | Pure utilities, config, types | `shared/`, `ports/` (types), `core/` (types), `app/` (context) |
| `test-helpers/` | Test mocks, fixtures, helpers | everything |

Enforced via oxlint `no-restricted-imports` overrides in `.oxlintrc.json`.

## Key Paths

- Entry: `source/app/index.ts` → `source/app/start.tsx` → `source/app/App.tsx`
- Context: `source/app/context.tsx`
- State: `source/core/state/state.ts`, types in `source/core/state/types.ts`
- Ports: `source/ports/player.ts`, `source/ports/database.ts`, `source/ports/filesystem.ts`
- DB: `source/adapters/sqlite/database.ts`, `source/adapters/sqlite/schema.ts`
- Player: `source/adapters/mpv/mpv.ts`
- Playback: `source/application/playback/playback.ts`
- Smart playlists: `source/core/playlists/` (DSL), `source/application/playlists/` (manager)
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
- Use `Result<T, E>` from `typescript-result` for fallible operations — propagate errors as values, not exceptions
- Don't use `enum` — use `as const` objects or discriminated unions
- Use `#/` path alias for source imports (e.g., `#/database/database`)

**RxJS / Observables**

- Suffix observable variables with `$` (e.g., `currentTrack$`, `playState$`)
- Observables should be hot by default — `shareReplay({ refCount: false, bufferSize: 1 })` for global/always-hot streams, `shareReplay({ refCount: true, bufferSize: 1 })` for caches that should auto-cleanup
- Keep RxJS streams declarative — avoid `state$.next()` side effects mid-pipeline, use derived state from the stream output (use tap(next()) as a last resort)

**React**

- Components are pure renderers — logic lives in the XState store, actions, or hooks
- Functional components only, no class components
- Custom hooks for reusable logic, keep components thin
- No `useMemo`/`useCallback` — React 19 handles memoization
- No `forwardRef` — React 19 passes `ref` as a regular prop
- Props should be generic (callbacks, primitives) — avoid passing store types or domain models into leaf components
- Extract non-trivial event handlers into named functions
- Colocate feature code: components + hooks in same feature folder
- No inline `function()` in JSX props — use arrow functions. Exception: when `this` binding is needed (e.g. OpenTUI's `onSizeChange`)

**Testing**

- Prefer `it()` over `test()` in test files
- Tests can assert multiple related behaviors in one `it()` block to avoid duplicating setup — especially in integration tests. Use assertion messages for clear failure pinpointing.

## Testability & Dependency Injection

- **No module-level singletons** — don't initialize state at module scope. Use React Context providers or factory functions with injected dependencies
- **Systems use constructor injection** — `createFoo(deps)` pattern. Provide dependencies via React Context, not module imports
- **Keep helper functions standalone** — in `createFoo(deps)` factories, prefer module-scope pure functions over nested closures. Pass deps explicitly rather than closing over them. Only the public API methods should live inside the factory return
- **Systems must be destroyable** — every system returns a `destroy()` for cleanup (tests, HMR, unmount)
- **Side effects must be explicit and cancelable** — no fire-and-forget inits. Use Observable subscriptions or cleanup functions that can be torn down
- **Decouple creation from wiring** — factory functions create systems, a provider wires them together. Tests can wire differently

## Core Principles

Pure functions, immutability, composition over inheritance, single responsibility, explicit errors, type-driven design, make illegal states unrepresentable, dependency injection, optimize for deletion and debugging, push complexity to edges, readable code over clever code.
