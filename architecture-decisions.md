# Architecture Decisions

## Ports & Adapters (Hexagonal Architecture)

Codebase restructured into `core/`, `ports/`, `adapters/`, `application/`, `ui/`, `app/`, `shared/`. Import boundaries enforced via oxlint `no-restricted-imports` overrides.

- **Why Hexagonal**: Was already ~80% in place (Player, AppDatabase, AppFileSystem interfaces). Made implicit boundaries explicit.
- **Why not Clean Architecture layers**: Hexagonal is simpler, fewer layers. No use-case interactors — `application/` handles that.
- **Rejected**: Feature-folder (by domain). Moo is a single-domain app; feature folders would just scatter infrastructure.

## Track as plain type (not class)

`Track` is a plain `type`, not an abstract class. Playback operations (`play`, `pause`, `seek`) live on the `Player` port, called directly with a `TrackId`.

- **Why**: The class coupled domain data to infrastructure (Player). `BaseTrack = Pick<Track, ...>` was a workaround. `LocalTrack` subclass existed just to set `sourceProvider = "local"`.
- **Rejected**: Keep class but inject player — still couples data shape to behavior.

## DI via AppContext

All dependencies flow through `createAppContext()` → React's `AppContextProvider` → `useAppContext()`. No module-level singletons.

- **React components**: `useAppContext()` or `useAppState()` convenience hook
- **Non-React systems**: Constructor injection via function parameters (`handleMpris(deps)`, `updateDatabase(deps)`, etc.)
- **Command callbacks**: `createCommandCallbacks({ appState, player })` — created in both `start.tsx` (for global commands) and `App.tsx` (for playback commands). Not on AppContext to avoid circular dep with `runner.tsx`.

**Why not on AppContext**: `callbacks.ts` imports `openRunner` from `runner.tsx`, which imports `useAppContext` from `context.tsx`. Putting command callbacks on AppContext would create: `context → callbacks → runner → context`.

## FileSystem abstraction for testable file watching

`AppFileSystem` type (`source/ports/filesystem.ts`) abstracts `node:fs` + chokidar. `createMusicLibrary` and `createPlaylistManager` take it as a dep.

- **Why not just inject chokidar**: Need to test the full pipeline (file → parse → DB), not just watching. `FileSystem` covers reads, stats, and writes too.
- **Why `parsing.ts` still exists**: `database.ts` needs `getPlaylistBlueprintFromId` for on-demand playlist resolution at query time. Moving it to `playlistManager` would create `database → playlistManager → database` circular dep. So `parsing.ts` keeps the query-time functions (real fs), while `playlistManager.ts` owns the watch/scan lifecycle (injected fs).
- **Rejected**: Passing `FileSystem` as extra param to existing loose functions — doesn't give us the `createFoo(deps)` → system object pattern the codebase uses.

## Playlist DSL imports Drizzle schema directly (allowed exception)

`core/playlists/schema.ts` imports `tableTracks` and `TrackColumnKey` from `adapters/sqlite/schema`. This violates the "core never imports adapters" rule but is explicitly allowed via oxlint `allowImportNames`.

- **Why allow it**: The alternative (static column metadata in shared/) duplicates 80+ column definitions that must stay in sync with the Drizzle schema. Not worth the maintenance cost.
- **Scope**: Only `tableTracks` and `TrackColumnKey` are allowed — no other adapter imports in core.

## Theme stream in app/ layer

`themeStream$` lives in `app/theme.ts`, not `shared/`. It does IO (file watching, renderer palette access) which violates shared's purity constraint. Types and schema stay in `shared/config/theme.ts`.

- **Why not application/**: Application can't import from adapters or app. Theme creation needs `createWatcher` (adapter) and `renderer` (app).
- **Why not inject via context**: `themeStream$` is a hot observable created once at startup — overkill for DI. UI imports it directly.
