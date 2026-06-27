---
phase: 03-knowledge-base-rag
plan: 04
subsystem: ui
tags: [zustand, tanstack-query, tanstack-table, react-arborist, sonner, shadcn, channel, kb, rag]

# Dependency graph
requires:
  - phase: 03-knowledge-base-rag
    plan: 00
    provides: RED tests (kb-indexing-store, kb-items-table), Drizzle kb schema, sonner/table/arborist deps
  - phase: 03-knowledge-base-rag
    plan: 03
    provides: six KB Tauri commands (import_file/add_url/create_note/query_kb/reindex_item/delete_item) + IndexProgress Channel + bindings.ts
provides:
  - "indexingStore (D-11): single source of truth for badge/progress/toast, normalizes snake_case Channel events, hydrateFromDb reconciles DB status (Pitfall 5)"
  - "kb queries (TanStack Query): useKbItems/useKbFolders/useNotesInFolder/useKbNote + import/url/reindex/delete mutations"
  - "shadcn primitives: progress.tsx, sonner.tsx (Toaster mounted in AppShell), table.tsx"
  - "KB browser components: ItemsTable (faceted filters), FolderTree (notes/folders), ImportDropzone (empty state), IndexStatusBadge"
  - "/kb route: two-pane browser wiring + Sidebar KB module enabled"
affects: [03-05, 03-06, 03-07]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-progress (for shadcn Progress)"]
  patterns:
    - "indexingStore.startIndexing mirrors chat.ts startStream (Channel + invoke), normalizing snake_case Rust events into camelCase UI events"
    - "KB UI components are PURE (props-driven) and render without a QueryClient; the route owns mutations and passes onReindex/onDelete callbacks"
    - "indexingStore is the reconciliation point: live Channel events win, DB status is the fallback (hydrateFromDb on load forces stuck 'indexing'→'failed')"

key-files:
  created:
    - src/lib/stores/indexing.ts
    - src/lib/queries/kb.ts
    - src/components/ui/progress.tsx
    - src/components/ui/sonner.tsx
    - src/components/ui/table.tsx
    - src/routes/kb/-components/IndexStatusBadge.tsx
    - src/routes/kb/-components/ItemsTable.tsx
    - src/routes/kb/-components/FolderTree.tsx
    - src/routes/kb/-components/ImportDropzone.tsx
  modified:
    - src/components/layout/AppShell.tsx
    - src/components/layout/Sidebar.tsx
    - src/routes/kb/index.tsx

key-decisions:
  - "indexingStore.IndexProgress uses camelCase (matches RED test + plan contract); startIndexing normalizes the snake_case bindings.ts Channel payload (item_id/total_chunks) before applying"
  - "KB components are pure/props-driven — mutation hooks moved out of ItemsTable/IndexStatusBadge into the route, so the RED test renders them standalone without a QueryClientProvider"
  - "Wired the /kb route + enabled the Sidebar KB module (Rule 2) so the browser is actually reachable — delivers KB-05 end-to-end, not just isolated components"
  - "Used react-resizable-panels v4 correct prop `orientation` (not the stale `direction` still used by chat/route.tsx) for the new two-pane split"

patterns-established:
  - "Channel event normalization: snake_case Rust → camelCase UI inside the store's startIndexing helper"
  - "Pure KB UI components + route-owned mutations (testability without provider)"

requirements-completed: [KB-05]

# Metrics
duration: 11min
completed: 2026-06-27
---

# Phase 3 Plan 04: KB Browser Data + Presentation Layer Summary

**A single Zustand `indexingStore` (D-11) reconciled with the DB status column drives all KB status surfaces; TanStack Query CRUD feeds a faceted-filterable TanStack Table, a react-arborist notes/folders tree, and a PT-BR drop-zone empty state — wired into a reachable two-pane `/kb` browser (KB-05).**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-27T03:53:23Z
- **Completed:** 2026-06-27T04:04:14Z
- **Tasks:** 3
- **Files created/modified:** 12

## Accomplishments

- **indexingStore (D-11)** — the single source of truth for indexing UI. `apply()` is the status state-machine (started→indexing, chunk→done/total, indexed, failed+reason); `setPending()` seeds a row before the Channel fires; `hydrateFromDb()` reconciles on reload and forces any stuck `indexing` row to `failed` (Pitfall 5: dropped Channel event); `startIndexing()` mirrors chat.ts `startStream` (new Channel → onmessage → invoke) and normalizes the snake_case Rust payload into camelCase.
- **kb queries** — `useKbItems` (soft-delete filtered, newest-first), `useKbFolders`, `useNotesInFolder`, `useKbNote`, plus `useImportFiles`/`useAddUrl`/`useReindexItem` (all routed through `indexingStore.startIndexing`) and `useDeleteItem` (bare `itemId`, per bindings) — each invalidates `kbKeys.items`.
- **shadcn primitives** — `progress.tsx` (Radix Progress), `sonner.tsx` Toaster (mounted in AppShell, dark theme + destructive-error styling), `table.tsx` — manual copy, no `npx shadcn add`.
- **IndexStatusBadge** — pure selector off the store reconciled with the DB `status`; all four PT-BR states with glyphs (Loader2 spinner / Check / AlertCircle) + `aria-label`; failed wraps a tooltip(reason) and exposes the "Reindexar" action (D-12).
- **ItemsTable** — TanStack Table v8 + shadcn Table: type-icon column, title, status badge, row actions (Reindexar / Excluir with Alert-Dialog confirm); faceted `Tipo`/`Status` toggle-button filters; empty result renders "Nenhum item encontrado para esse filtro." (D-09/D-10).
- **FolderTree** — react-arborist dense (28px) tree of folders + note items ONLY (D-10); selecting a note calls `onSelectNote` (Plan 03-05 editor wiring), a folder calls `onSelectFolder`.
- **ImportDropzone** — D-13 empty state: dashed drop zone (accent on drag-over), Tauri file picker + native `onDragDropEvent` drop handling, URL paste with "URL adicionada. Indexando..." toast.
- **/kb route** — two-pane resizable browser (tree 20–40% + table) that hydrates the indexingStore from the DB on load and falls back to the dropzone when the KB is empty; Sidebar KB module enabled so the surface is reachable.

## indexingStore API + import/url invoke flow (for Plans 03-05 / 03-06)

```ts
import { useIndexingStore } from '@/lib/stores/indexing';

// Seed pending the instant an item is added, then stream progress:
const { setPending, startIndexing } = useIndexingStore.getState();
setPending(itemId);
await startIndexing('import_file', { itemId, path, title });   // file
await startIndexing('add_url',     { itemId, url });            // url
await startIndexing('create_note', { itemId, title, content, folderId }); // note (03-05)
await startIndexing('reindex_item',{ itemId });                 // reindex (D-12)

// Select live status anywhere (reconcile with DB status as fallback):
const entry = useIndexingStore((s) => s.items[itemId]); // { status, reason?, done?, total? }

// On load, reconcile with the DB once (forces stuck 'indexing' → 'failed'):
useIndexingStore.getState().hydrateFromDb(items.map(i => ({ id: i.id, status: i.status, errorReason: i.errorReason })));
```

- The kb query mutations (`useImportFiles`/`useAddUrl`/`useReindexItem`) already wrap `setPending` + `startIndexing`; prefer them in React components.
- `IndexProgress` (UI) is camelCase — `{ event, data: { itemId, ... } }`. The raw Channel payload from bindings.ts is snake_case; `startIndexing` does the conversion, so consumers never see snake_case.

## Task Commits

1. **Task 1: indexingStore + KB queries** — `3af79b6` (feat)
2. **Task 2: Progress/Sonner/Table primitives + IndexStatusBadge** — `0f3f189` (feat)
3. **Task 3: ItemsTable + FolderTree + ImportDropzone + /kb route** — `2bbeef6` (feat)

## Files Created/Modified

- `src/lib/stores/indexing.ts` — indexingStore (D-11), the single status source + Channel normalization.
- `src/lib/queries/kb.ts` — TanStack Query reads/mutations for KB items/folders/notes.
- `src/components/ui/progress.tsx` / `sonner.tsx` / `table.tsx` — new shadcn primitives.
- `src/routes/kb/-components/IndexStatusBadge.tsx` — 4-state status badge + Reindexar/tooltip.
- `src/routes/kb/-components/ItemsTable.tsx` — faceted-filter data table.
- `src/routes/kb/-components/FolderTree.tsx` — notes/folders tree.
- `src/routes/kb/-components/ImportDropzone.tsx` — empty-state import affordances.
- `src/routes/kb/index.tsx` — two-pane browser wiring (was a ModuleStub).
- `src/components/layout/AppShell.tsx` — mounted `<Toaster />`.
- `src/components/layout/Sidebar.tsx` — enabled the KB module (`implemented: true`).

## Decisions Made

- `IndexProgress` (UI type) is camelCase to satisfy the RED test/plan contract; the snake_case-to-camelCase bridge lives in `startIndexing`.
- KB components made pure (mutations lifted to the route) so the RED tests render them without a QueryClientProvider.
- Wired the route + enabled the Sidebar module to deliver KB-05 end-to-end rather than leaving orphaned components.
- Used the correct v4 `orientation` prop for the resizable group.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing `@radix-ui/react-progress` dependency**
- **Found during:** Task 2 (shadcn Progress primitive)
- **Issue:** The shadcn Progress component imports `@radix-ui/react-progress`, which was not in package.json — the file would not compile.
- **Fix:** `pnpm add @radix-ui/react-progress`.
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** `tsc` resolves the import; progress.tsx type-checks.
- **Committed in:** 0f3f189 (Task 2 commit)

**2. [Rule 1 - Bug] KB components crashed without a QueryClientProvider**
- **Found during:** Task 3 (kb-items-table RED test run)
- **Issue:** `ItemsTable`/`IndexStatusBadge` called `useReindexItem`/`useDeleteItem` at the top level, so `useQueryClient()` threw when the RED test rendered `<ItemsTable>` standalone (no provider).
- **Fix:** Lifted the mutation calls out into the `/kb` route; the pure components now take optional `onReindex`/`onDelete`/`reindexPending` props. The route (which owns the QueryClient) wires the real mutations.
- **Files modified:** ItemsTable.tsx, IndexStatusBadge.tsx, kb/index.tsx
- **Verification:** `vitest run kb-items-table` → 3/3 pass.
- **Committed in:** 2bbeef6 (Task 3 commit)

**3. [Rule 2 - Missing Critical] Wired the /kb route + enabled the Sidebar KB module**
- **Found during:** Task 3
- **Issue:** `src/routes/kb/index.tsx` was still a `ModuleStub` and the Sidebar had the KB module `implemented: false`. Without wiring, the new browser was unreachable and KB-05 (file-explorer view) would not be delivered. The UI-SPEC explicitly lists both changes.
- **Fix:** Replaced the stub with the two-pane browser (tree + table / dropzone empty state, indexingStore hydration on load) and set the Sidebar KB module to `implemented: true`.
- **Files modified:** src/routes/kb/index.tsx, src/components/layout/Sidebar.tsx
- **Verification:** `tsc` clean for these files; `vitest run routes` → 3/3 pass.
- **Committed in:** 2bbeef6 (Task 3 commit)

**4. [Rule 1 - Bug] Used the correct react-resizable-panels v4 prop**
- **Found during:** Task 3 (route compile)
- **Issue:** `ResizablePanelGroup` typed `direction` triggered TS2322; v4 renamed the prop to `orientation`.
- **Fix:** Used `orientation="horizontal"` in the new route.
- **Files modified:** src/routes/kb/index.tsx
- **Verification:** `tsc` clean for kb/index.tsx.
- **Committed in:** 2bbeef6 (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking dep, 2 bugs, 1 missing critical wiring).
**Impact on plan:** All necessary for correctness and to deliver KB-05 end-to-end. No scope creep beyond the UI-SPEC's stated changes.

## Issues Encountered

- The bindings.ts `IndexProgress` is snake_case while the RED test/plan use camelCase — resolved by normalizing inside `startIndexing` (documented above), keeping the store's public type camelCase.

## Deferred Issues (out of scope — logged in deferred-items.md)

- `tests/channel.test.ts > streamLlmDemo` FAILS — stale test for a binding removed by 03-03 (not a 03-04 file).
- `tests/kb-notes-editor.test.tsx` FAILS — Plan 03-05's RED test (notes editor), green is owned by 03-05.
- Pre-existing `tsc` errors in `chat.ts`, `appearance.ts`, `settings.ts`, `MarkdownRenderer.tsx`, `chat/route.tsx` (other plans / parallel 03-06) — not touched.

## Known Stubs

None that block the plan goal. `FolderTree.onSelectNote` and `useKbNote` intentionally expose only the item row — the actual note-content read + editor is owned by Plan 03-05 (D-08). This is the planned hand-off boundary, not an unwired stub.

## Next Phase Readiness

- **Plan 03-05 (notes editor):** consume `FolderTree.onSelectNote` + `useKbNote`; use `startIndexing('create_note', ...)` to index saved notes. The note content lives at `app-data/kb-notes/<id>.md` (D-08).
- **Plan 03-06 (chat grounding):** the indexingStore + sonner Toaster are mounted globally; reuse `useIndexingStore` selectors for any chat-side status surfaces.
- Global batch `Progress` panel ("Indexando {done} de {total}") infra exists (progress.tsx) but the aggregate-count panel UI is a thin follow-up if a future plan wants the batch bar surfaced.

---
*Phase: 03-knowledge-base-rag*
*Completed: 2026-06-27*

## Self-Check: PASSED

- All 9 created source files exist on disk (indexing.ts, kb.ts, progress/sonner/table.tsx, IndexStatusBadge/ItemsTable/FolderTree/ImportDropzone.tsx).
- Task commits 3af79b6, 0f3f189, 2bbeef6 all present in git history.
- Target tests GREEN: `kb-indexing-store` (4/4) + `kb-items-table` (3/3); `routes` (3/3) unbroken.
