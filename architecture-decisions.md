# Architecture Decisions

## DI via AppContext 

All dependencies flow through `createAppContext()` → React's `AppContextProvider` → `useAppContext()`. No module-level singletons.

- **React components**: `useAppContext()` or `useAppState()` convenience hook
- **Non-React systems**: Constructor injection via function parameters (`handleMpris(deps)`, `updateDatabase(deps)`, etc.)
- **Command callbacks**: `createCommandCallbacks({ appState, currentTrack$ })` — created in both `start.tsx` (for global commands) and `App.tsx` (for playback commands). Not on AppContext to avoid circular dep with `runner.tsx`.

**Why not on AppContext**: `commandsCallbacks.ts` imports `openRunner` from `runner.tsx`, which imports `useAppContext` from `appContext.tsx`. Putting command callbacks on AppContext would create: `appContext → commandsCallbacks → runner → appContext`.