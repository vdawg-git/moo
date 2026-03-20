# Architecture Decisions

## DI via AppContext

All dependencies flow through `createAppContext()` → React's `AppContextProvider` → `useAppContext()`. No module-level singletons.

- **React components**: `useAppContext()` or `useAppState()` convenience hook
- **Non-React systems**: Constructor injection via function parameters (`handleMpris(deps)`, `updateDatabase(deps)`, etc.)
- **Command callbacks**: `createCommandCallbacks({ appState, currentTrack$ })` — created in both `start.tsx` (for global commands) and `App.tsx` (for playback commands). Not on AppContext to avoid circular dep with `runner.tsx`.

**Why not on AppContext**: `commandsCallbacks.ts` imports `openRunner` from `runner.tsx`, which imports `useAppContext` from `appContext.tsx`. Putting command callbacks on AppContext would create: `appContext → commandsCallbacks → runner → appContext`.

## FileSystem abstraction for testable file watching

`FileSystem` type (`source/filesystem.ts`) abstracts `node:fs` + chokidar. `createMusicLibrary` and `createPlaylistManager` take it as a dep.

- **Why not just inject chokidar**: Need to test the full pipeline (file → parse → DB), not just watching. `FileSystem` covers reads, stats, and writes too.
- **Why `parsing.ts` still exists**: `database.ts` needs `getPlaylistBlueprintFromId` for on-demand playlist resolution at query time. Moving it to `playlistManager` would create `database → playlistManager → database` circular dep. So `parsing.ts` keeps the query-time functions (real fs), while `playlistManager.ts` owns the watch/scan lifecycle (injected fs).
- **Rejected**: Passing `FileSystem` as extra param to existing loose functions — doesn't give us the `createFoo(deps)` → system object pattern the codebase uses.
