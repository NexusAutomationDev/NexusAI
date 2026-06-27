# Deferred Items — Phase 03 (out of scope for plan 03-06)

Pre-existing `pnpm run build` (tsc) errors present in the working tree BEFORE plan 03-06
edits. Not caused by this plan's changes (citations.ts / chat store grounding). Logged
per the executor SCOPE BOUNDARY rule — NOT fixed here.

Discovered: 2026-06-27 during plan 03-06 Task 1 build.

- `src/lib/queries/chat.ts(259,37)` — TS6133 `conversationId` declared but never read (pre-existing).
- `src/lib/stores/appearance.ts(38,55)` — TS2345 StoreOptions missing `defaults` (Tauri Store plugin API).
- `src/lib/stores/settings.ts(79,53)` — TS2345 StoreOptions missing `defaults` (same as above).
- `src/routes/chat/route.tsx(22,28)` — TS2322 `direction` prop not on div (likely a resizable-panel typing issue).

Note: errors in `MessageInput.tsx(134/211)` and `MarkdownRenderer.tsx(30)` are touched by
plan 03-06 Tasks 2/3 and were addressed/triaged there where in-scope.

## From Plan 03-04 (executor)

Pre-existing test failures unrelated to 03-04 files (indexing.ts / kb.ts / kb UI components):

- `tests/channel.test.ts > streamLlmDemo function exists in bindings.ts` FAILS — the `streamLlmDemo`
  demo binding was removed when 03-03 regenerated bindings.ts via the headless export bin. Stale test;
  owner is a binding/chat test cleanup, not 03-04.
- `tests/kb-notes-editor.test.tsx` FAILS (module-not-found) — this is Plan 03-05's RED test (notes
  editor). Green is owned by Plan 03-05, not 03-04.
