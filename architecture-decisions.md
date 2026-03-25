# Architecture Decisions

## Ports & Adapters (Hexagonal Architecture)

`core/`, `ports/`, `adapters/`, `application/`, `ui/`, `app/`, `shared/`. Import boundaries enforced via oxlint.

- **Why not feature-folders**: Moo is single-domain; feature folders would scatter infrastructure without benefit.
- **Why not Clean Architecture**: Simpler — fewer layers, no use-case interactors.

## Track as plain type (not class)

`Track` is a plain `type`. Playback operations live on the `Player` port, called with a `TrackId`.

- **Why**: A class couples domain data to infrastructure. Subclasses (`LocalTrack`) existed only to set a discriminant.
- **Rejected**: Class with injected player — still couples data shape to behavior.

## DI via AppContext

All dependencies flow through `createAppContext()` → React `AppContextProvider` → `useAppContext()`. Non-React systems use constructor injection via function parameters.

- **Why**: No module-level singletons; every system is testable and destroyable.

## Playlist DSL imports Drizzle schema (allowed exception)

`core/playlists/schema.ts` imports `tableTracks` and `TrackColumnKey` from `adapters/sqlite/schema`. Violates "core never imports adapters" — explicitly allowed via oxlint `allowImportNames`.

- **Why**: Abstracting 80+ column definitions into shared/ just to avoid the import creates duplication that must stay in sync.
- **Scope**: Only `tableTracks` and `TrackColumnKey` — no other adapter imports in core.

## Zone-based keybinding system

Dot-separated zone strings (`"default"`, `"default.quickEdit.suggestions"`, `"modal"`). Commands register to a zone; prefix matching fires parent-zone commands unless shadowed by a more specific zone.

- **Why zones over flat enum**: Sub-regions need different bindings for the same keys (e.g., `j`/`k` in suggestions vs. applied tags).
- **Why prefix matching**: Global keys (e.g., `space` for playback) should pass through to child zones, but zone-specific binds shadow them.
- **Rejected**: Separate keybinding managers per page — duplicates infrastructure, no global command passthrough.

## Command types (CommandReference | CommandInline)

`useKeybindings` accepts `CommandArgument = CommandReference | CommandInline`. `CommandReference` has `commandId: AppCommandID`, `CommandInline` has `label + keybindings`. Discriminant: `"commandId" in command`. Resolution to `ResolvedCommand` happens in `useKeybindings`.

- **Why `commandId` not `id`**: `AppCommand.id` stays as a domain type. `commandId` only exists in keybind-specific types to avoid overlap with auto-generated trie keys.
- **Why auto-generated trie keys**: Inline commands don't need caller-supplied IDs. Registration returns a cleanup fn; unregistration is handled via captured closures.
- **Why `disableCommand` over `unregisterKeybinds`**: Callers (e.g., runner) that need to suppress someone else's command shouldn't fabricate registration objects. A disabled-set check in `filterCommandsByZone` is simpler and doesn't require re-registration on re-enable.

## Abort command with allowDuringInput

`abort` is a generic `AppCommandID` (bound to `esc`). In `useFocusZones`, abort callbacks are registered with `allowDuringInput: true` so escape works even when an input field captures keys.

- **Why not a per-page escape handler**: Zone-specific abort (input→blur vs. suggestions→close dialog) requires per-zone callbacks. A single top-level handler can't know the intent.
- **Why split in useFocusZones**: Abort is the only command that must pierce input capture. Splitting it from regular zone commands keeps the `allowDuringInput` concern localized.

## Theme stream in app/ layer

`themeStream$` lives in `app/theme.ts`. It does IO (file watching, renderer palette) so it can't live in `shared/`. Types stay in `shared/config/theme.ts`.

- **Why app/ not application/**: Needs `createWatcher` (adapter) and `renderer` (app) — application/ can't import those.
- **Why not DI**: Hot observable created once at startup; DI adds complexity for no testing benefit.
