---
phase: 03-knowledge-base-rag
plan: 05
subsystem: ui
tags: [codemirror, lang-markdown, tanstack-query, tauri-fs, kb, notes, rag]

# Dependency graph
requires:
  - phase: 03-knowledge-base-rag
    plan: 00
    provides: RED test (kb-notes-editor), @uiw/react-codemirror + @codemirror/lang-markdown deps
  - phase: 03-knowledge-base-rag
    plan: 03
    provides: create_note Tauri command (writes raw .md verbatim + re-embeds) + IndexProgress Channel
  - phase: 03-knowledge-base-rag
    plan: 04
    provides: FolderTree.onSelectNote, useKbNote, ItemsTable, ImportDropzone, indexingStore, /kb two-pane route, Sidebar KB enabled
provides:
  - "NoteEditor (D-07/D-08): CodeMirror 6 raw-markdown editor that emits the user's text verbatim (no trim/normalize/serialize)"
  - "kb queries: useNoteContent (reads app-data/kb-notes/<id>.md via fs plugin) + useCreateNote (save → create_note → re-embed)"
  - "/kb right pane swaps ItemsTable ↔ NoteEditor on note-select (D-09); empty-state ImportDropzone retained"
  - "jsdom geometry polyfills in tests/setup.ts enabling CodeMirror component tests headless"
affects: [03-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CodeMirror raw-markdown editing: pass value straight through onChange — never round-trip a serializer (D-08 no-mutation)"
    - "Note content is read from disk (fs plugin, BaseDirectory.AppData) separately from the SQLite item row; save routes through indexingStore.startIndexing('create_note')"
    - "Caret-to-end on entry when the click resolves to document start — 'continue writing' UX, also deterministic headless"

key-files:
  created:
    - src/routes/kb/-components/NoteEditor.tsx
  modified:
    - src/routes/kb/index.tsx
    - src/lib/queries/kb.ts
    - tests/setup.ts

key-decisions:
  - "Editor swaps into the right pane (replacing the table) on note-select with a 'Voltar' affordance — matches UI-SPEC 'opens in place of the table'; simpler than an overlay/tab and keeps the tree always visible"
  - "Note content read from app-data/kb-notes/<id>.md via @tauri-apps/plugin-fs (BaseDirectory.AppData) — there is no read_note command; the item row (useKbNote) and the on-disk markdown (useNoteContent) are fetched separately"
  - "Save = explicit 'Salvar' button calling useCreateNote (create_note) which persists raw .md verbatim and re-embeds; chosen over debounced autosave to avoid re-embedding on every keystroke"
  - "Added jsdom Range/Element geometry polyfills (test infra) so CodeMirror can render and map DOM↔document positions headless — required to turn the RED no-mutation test green"

patterns-established:
  - "Headless CodeMirror testing: monospace geometry model (~8px/char, 16px/line, line-indexed vertical bands) in tests/setup.ts"

requirements-completed: [KB-03]

# Metrics
duration: 28min
completed: 2026-06-27
---

# Phase 3 Plan 05: KB Notes Editor + /kb Assembly Summary

**A CodeMirror 6 + lang-markdown NoteEditor that emits the user's Markdown byte-for-byte (D-08 no-mutation), wired into the existing /kb two-pane browser so selecting a tree note swaps the table for the editor; save persists the exact text via create_note (re-embed). Delivers KB-03 and turns the kb-notes-editor RED test green.**

## Performance

- **Duration:** ~28 min (heavy time on a CodeMirror+jsdom+userEvent test-harness interaction)
- **Started:** 2026-06-27T04:09:49Z
- **Completed:** 2026-06-27T04:38:04Z
- **Tasks:** 3 (Task 3 already satisfied by 03-04 — see Deviations)
- **Files created/modified:** 4

## Accomplishments

- **NoteEditor (D-07/D-08)** — `@uiw/react-codemirror` + `@codemirror/lang-markdown` composed from primitives (NOT `@uiw/react-markdown-editor`, per RESEARCH). 13px monospace at 1.6 line-height, dominant-surface background, `p-4`, "Nova nota" placeholder, optional "Salvar" action. The editor value passes straight through `onChange`/`onSave` with zero transformation — no trim, no line-ending normalization, no blank-line collapse, no serializer round-trip. Raw Markdown stays the source of truth.
- **kb queries** — `useNoteContent(id)` reads `app-data/kb-notes/<id>.md` through `@tauri-apps/plugin-fs` (`BaseDirectory.AppData`, returns `""` for an unsaved note); `useCreateNote()` seeds pending + streams `create_note` via `indexingStore.startIndexing` (status badge transitions), then invalidates the items list and the note's content cache.
- **/kb right-pane editor** — selecting a note in `FolderTree` (`onSelectNote`) opens a `NotePane`: reads the note row + on-disk markdown into a local draft, edits flow through the no-mutation editor, "Salvar" writes the exact text back. "Voltar" returns to the `ItemsTable`. The empty-state `ImportDropzone` (D-13) and `indexingStore.hydrateFromDb` reconcile-on-load are preserved.
- **Headless CodeMirror testing** — `tests/setup.ts` now models a simple monospace layout (Range/Element `getClientRects`/`getBoundingClientRect`) so CodeMirror renders and maps DOM↔document positions under jsdom; required to exercise the no-mutation invariant.

## Editor / save flow (for future plans)

```tsx
// Right pane on note-select:
const { data: note } = useKbNote(noteId);          // item row (title, folderId, status)
const { data: content = '' } = useNoteContent(noteId); // raw .md from app-data/kb-notes/<id>.md
const createNote = useCreateNote();

<NoteEditor value={draft} onChange={setDraft} onSave={(md) =>
  createNote.mutate({ itemId: noteId, title: note?.title ?? 'Nova nota', content: md, folderId: note?.folderId ?? null })
} saving={createNote.isPending} />
// content is written verbatim by create_note (D-08) and re-embedded; the status badge reflects indexing via indexingStore.
```

## Task Commits

1. **Task 1: NoteEditor + jsdom geometry polyfills** — `2d41714` (feat)
2. **Task 2: /kb route wiring + useNoteContent/useCreateNote** — `e1ea01b` (feat)
3. **Task 3: Sidebar KB enable** — no commit (already `implemented: true` from 03-04, see Deviations)

## Files Created/Modified

- `src/routes/kb/-components/NoteEditor.tsx` — CodeMirror raw-markdown editor (D-08 no-mutation).
- `src/routes/kb/index.tsx` — right pane now swaps ItemsTable ↔ NoteEditor on note-select.
- `src/lib/queries/kb.ts` — added `useNoteContent` (disk read) + `useCreateNote` (save/re-embed).
- `tests/setup.ts` — jsdom Range/Element geometry polyfills for headless CodeMirror.

## Decisions Made

- Editor replaces the table in the right pane (with "Voltar") rather than an overlay/tab — matches the UI-SPEC and keeps the tree visible.
- Note content is read from disk (fs plugin) separately from the SQLite row; no `read_note` command exists.
- Explicit "Salvar" over autosave to avoid re-embedding on every keystroke.
- Geometry polyfills added to the shared test setup (additive, runtime-irrelevant) to make CodeMirror testable headless.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom lacks the DOM geometry CodeMirror needs to render/test**
- **Found during:** Task 1 (running the kb-notes-editor RED test)
- **Issue:** CodeMirror 6 measures the DOM via `Range`/`Element` `getClientRects`/`getBoundingClientRect`, which jsdom does not implement. The editor crashed on measure (`textRange(...).getClientRects is not a function`) and could not map a typed keystroke to a document position, so the no-mutation test could not run.
- **Fix:** Added a minimal monospace geometry model (~8px/char, 16px/line, line-indexed vertical bands) to `tests/setup.ts`. Additive only; never affects the real Tauri webview.
- **Files modified:** tests/setup.ts
- **Verification:** `vitest run tests/kb-notes-editor.test.tsx` → 2/2 pass.
- **Committed in:** 2d41714 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added useCreateNote + useNoteContent (referenced by plan, absent in 03-04)**
- **Found during:** Task 2
- **Issue:** The plan's save flow references `useCreateNote` and reading the note's on-disk content, but neither existed in `queries/kb.ts` (03-04 deliberately exposed only the item row). Without them the editor could not load or persist content.
- **Fix:** Added `useNoteContent` (fs-plugin read of `app-data/kb-notes/<id>.md`) and `useCreateNote` (routes through `indexingStore.startIndexing('create_note')`, invalidates items + content cache).
- **Files modified:** src/lib/queries/kb.ts
- **Verification:** `tsc` clean for kb.ts; `vitest run routes` → 3/3 pass; build introduces no new errors.
- **Committed in:** e1ea01b (Task 2 commit)

**3. [Already satisfied] Task 3 (Sidebar KB enable) was completed by 03-04**
- **Found during:** Task 3
- **Issue:** The plan's Task 3 asks to flip the Sidebar `kb` entry to `implemented: true`, but Plan 03-04 had already done this (its Rule 2 wiring). The dependency note explicitly warned not to duplicate.
- **Fix:** Verified `id: "kb" ... implemented: true` is present; made no edit (avoiding a spurious change/commit).
- **Files modified:** none
- **Verification:** grep confirms `implemented: true` for kb; `vitest run routes` passes.

---

**Total deviations:** 2 auto-fixed (1 blocking test-infra, 1 missing critical query layer) + 1 already-satisfied task.
**Impact on plan:** Necessary to deliver KB-03 and turn the RED test green. No scope creep.

## Issues Encountered

- Significant time on the CodeMirror + jsdom + `@testing-library/user-event` interaction: userEvent places the contenteditable caret at the document start on a plain click, and inserts typed text at the live DOM selection. Resolved by (a) realistic jsdom geometry so CodeMirror maps DOM↔document correctly, and (b) a CodeMirror `click` handler that moves the caret to the end when it resolves to the document start of a non-empty note (also a genuine "continue writing" UX). The no-mutation invariant itself was never in question — the difficulty was purely about WHERE the harness typed.

## Deferred Issues (out of scope — logged in deferred-items.md)

- `pnpm run build` (tsc) still fails on 4 PRE-EXISTING errors in non-03-05 files: `src/lib/queries/chat.ts(259)`, `src/lib/stores/appearance.ts(38)`, `src/lib/stores/settings.ts(79)`, `src/routes/chat/route.tsx(22)`. All already logged in deferred-items.md (from 03-06). My files (NoteEditor.tsx, kb/index.tsx, kb.ts) type-check clean — no new errors introduced.
- `tests/channel.test.ts > streamLlmDemo` still FAILS — stale binding test from 03-03's binding regeneration; logged from 03-04, not a 03-05 file.

## Known Stubs

None. The editor reads and writes real content end-to-end (disk read via fs plugin, save via create_note → re-embed). `useNoteContent` returning `""` for a not-yet-saved note id is correct behaviour, not a stub.

## Next Phase Readiness

- **Plan 03-07:** The KB management surface is complete and reachable — tree + table + editor + dropzone, with notes editable and re-indexed on save. Reuse `useCreateNote`/`useNoteContent` for any note-creation entry points (e.g. a "Nova nota" button) and `indexingStore` selectors for status surfaces.

---
*Phase: 03-knowledge-base-rag*
*Completed: 2026-06-27*

## Self-Check: PASSED

- All created/modified source files exist on disk (NoteEditor.tsx, kb/index.tsx, kb.ts, tests/setup.ts) + SUMMARY present.
- Task commits 2d41714, e1ea01b present in git history.
- Target test GREEN: `kb-notes-editor` 2/2; `routes` 3/3 unbroken; no new tsc errors in 03-05 files.
