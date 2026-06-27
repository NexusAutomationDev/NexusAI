---
phase: 03-knowledge-base-rag
plan: 03
subsystem: knowledge-base
tags: [tauri-commands, specta, channel, rusqlite, fastembed, sqlite-vec, fts5, rag, ipc]

# Dependency graph
requires:
  - phase: 03-knowledge-base-rag
    plan: 01
    provides: ingest (parse_file/fetch_url/extract_article), chunk_default, schema IPC types
  - phase: 03-knowledge-base-rag
    plan: 02
    provides: embed (global_model/embed_query/embed_passages), vector (register/init/insert/knn/delete), search (init_fts_table/hybrid_search)
provides:
  - "store.rs: kb_connection bootstrap + index_item/reindex_item/delete_item + query_chunks (KB-06, no scoping)"
  - "progress.rs: Channel<IndexProgress> emit helper (FOUND-05)"
  - "Six Tauri commands: import_file, add_url, create_note, query_kb, reindex_item, delete_item"
  - "src-tauri/src/lib.rs: KB commands registered + sqlite-vec registered at startup"
  - "bindings.ts: KB command bindings + Input/Output types exported to the frontend"
affects: [03-04, 03-05, 03-06, 03-07, agents, phase-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Heavy ingest/embedding runs on tauri::async_runtime::spawn_blocking (non-blocking async runtime)"
    - "kb_connection opens the shared nexusai.db, creates relational tables IF NOT EXISTS + bootstraps vec0/fts5 virtual tables"
    - "Headless tauri-specta export via a dedicated src/bin/export-bindings.rs (no GUI launch)"

key-files:
  created:
    - src-tauri/crates/nexusai-kb/src/progress.rs
    - src-tauri/src/bin/export-bindings.rs
  modified:
    - src-tauri/crates/nexusai-kb/src/store.rs
    - src-tauri/crates/nexusai-kb/src/lib.rs
    - src-tauri/src/lib.rs
    - src/lib/bindings.ts

key-decisions:
  - "kb_connection creates kb_items/kb_chunks with IF NOT EXISTS (defensive — Drizzle 0002_kb.sql owns them on the JS side; Rust must still work if it opens first)"
  - "Used tauri::async_runtime::spawn_blocking (Tauri-idiomatic) instead of raw tokio::task::spawn_blocking"
  - "store::index_item owns its own terminal failure marking + Failed emission (D-12) so command callers never leave a row stuck 'indexing'"
  - "query_chunks preserves the fusion input order and skips missing rowids (concurrent-delete safe)"
  - "Bindings regenerated via a dedicated debug-only bin (cargo run --bin export-bindings) because the root crate's cdylib/staticlib crate-type can't run as a cargo test (STATUS_ENTRYPOINT_NOT_FOUND from WebView2 linkage)"

requirements-completed: [KB-01, KB-02, KB-04, KB-06]

# Metrics
duration: 11min
completed: 2026-06-27
---

# Phase 3 Plan 03: KB Tauri Integration Layer Summary

**Wired the Plan 03-01/03-02 retrieval primitives into six registered Tauri commands — ingest→chunk→embed→store with streamed `IndexProgress`, hybrid `query_kb` returning unscoped citations (KB-06), idempotent re-index (D-12) — plus sqlite-vec registered at startup and KB types exported to bindings.ts.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-27T03:37:20Z
- **Completed:** 2026-06-27T03:48:36Z
- **Tasks:** 3
- **Files created/modified:** 6

## Accomplishments

- **progress.rs** — `emit(ch, ev)` thin Channel helper swallowing send errors (`.ok()`), mirroring nexusai-chat/streaming.rs (FOUND-05: never `emit()` in a loop).
- **store.rs** — real persistence over the shared `nexusai.db`:
  - `kb_connection(db_path)` opens the DB, sets `foreign_keys=ON`, creates `kb_items`/`kb_chunks` with `IF NOT EXISTS` (matches 0002_kb.sql), and bootstraps the `vec0` + `fts5` virtual tables/triggers.
  - `index_item` chunks via `chunk_default`, embeds via `embed_passages`, then in a single transaction inserts each `kb_chunks` row (FTS synced by trigger) + `vector::insert_vector` keyed by the shared rowid, streaming `Started → Chunk(done/total) → Indexed` progress (D-11). On any error: `set_failed` (terminal) + `Failed` event (D-12).
  - `reindex_item` / `delete_chunks_for_item` — idempotent: collect chunk rowids, `vector::delete_vectors_for_rowids`, then `DELETE FROM kb_chunks WHERE item_id=?` (FTS cleaned by trigger), all in a transaction (D-12).
  - `query_chunks` — joins `kb_chunks → kb_items` to build `Citation { id, item_id, item_title, kind, section, snippet }`, **NO owner/agent filter** (KB-06, D-16), preserves fusion order.
- **lib.rs (crate)** — six commands behind the inner-module specta pattern (mirrors nexusai-chat exactly): `import_file`, `add_url`, `create_note`, `query_kb`, `reindex_item`, `delete_item`. All heavy work on `spawn_blocking`; notes write RAW markdown to `app-data/kb-notes/<id>.md` with no normalization (D-08).
- **src-tauri/src/lib.rs** — `nexusai_kb::collect_commands()` added to the specta export; six commands appended to `generate_handler!`; `register_sqlite_vec()` + `kb_connection()` bootstrap called in `setup()` AFTER `initialize_database` (Pattern 1 ordering). Extracted `export_bindings()` as the single export source of truth.
- **bindings.ts** — regenerated headlessly via the new `export-bindings` bin; all six KB commands + their I/O types now exported.

## KB Command Bindings (for frontend plans 03-04/03-05/03-06)

| Command (TS) | Invoke | Input | Output |
| ------------ | ------ | ----- | ------ |
| `commands.importFile` | `import_file` | `ImportFileInput { itemId, path, title }` + `Channel<IndexProgress>` | `null` |
| `commands.addUrl` | `add_url` | `AddUrlInput { itemId, url }` + `Channel<IndexProgress>` | `null` |
| `commands.createNote` | `create_note` | `CreateNoteInput { itemId, title, content, folderId\|null }` + `Channel<IndexProgress>` | `null` |
| `commands.queryKb` | `query_kb` | `QueryKbInput { query, topK }` | `QueryKbOutput { chunks: Citation[] }` |
| `commands.reindexItem` | `reindex_item` | `ReindexInput { itemId }` + `Channel<IndexProgress>` | `null` |
| `commands.deleteItem` | `delete_item` | `itemId: string` | `null` |

**Citation** = `{ id, itemId, itemTitle, kind: KbKind, section: string\|null, snippet }`.
**IndexProgress** = tagged enum `{ event: "started"\|"chunk"\|"indexed"\|"failed", data: {...} }` (same shape as chat `StreamEvent` — reuse the Channel handler).
**KbKind** = `"file" | "note" | "url"`.

## Task Commits

1. **Task 1: progress.rs + store.rs persistence/query** — `731d013` (feat)
2. **Task 2: six Tauri commands (crate lib.rs)** — `62b3e27` (feat)
3. **Task 3: app registration + sqlite-vec startup + bindings** — `fdb4e3a` (feat)

## Verification

- `cargo test -p nexusai-kb query` → 2/2 pass (KB-06 `test_query_chunks_no_scoping` now GREEN + an order/kind-mapping test).
- `cargo test -p nexusai-kb` → 8 passed, 1 ignored (offline embedding, criterion #5), 0 failed — no regressions to chunk/vector/rrf/scrape.
- `cargo build` (workspace) → exits 0 with KB wired in (only pre-existing nexusai-chat deprecation warning).
- `cargo run --bin export-bindings` → regenerated `src/lib/bindings.ts`; `grep` confirms `importFile`/`addUrl`/`createNote`/`queryKb`/`reindexItem`/`deleteItem` + their types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Headless bindings regeneration (`cargo build` does NOT regenerate bindings.ts)**
- **Found during:** Task 3
- **Issue:** The plan said "run `cargo build` so tauri-specta regenerates bindings.ts." The specta export actually runs at *app runtime* inside `run()` (the `#[cfg(debug_assertions)]` block), not at build time — a plain `cargo build` never writes the file. A `cargo test` calling the export failed with `STATUS_ENTRYPOINT_NOT_FOUND` because the root crate's `cdylib`/`staticlib` crate-type can't load as a test executable (WebView2 DLL linkage).
- **Fix:** Extracted the export into `pub fn export_bindings()` and added `src-tauri/src/bin/export-bindings.rs`, a debug-only bin that calls it and exits before the Tauri event loop — `cargo run --bin export-bindings` regenerates bindings.ts headlessly (CI/parallel-executor safe).
- **Files modified:** src-tauri/src/lib.rs (refactor), src-tauri/src/bin/export-bindings.rs (new)
- **Verification:** `cargo run --bin export-bindings` prints "bindings.ts regenerated"; KB commands present in the file.
- **Committed in:** fdb4e3a (Task 3 commit)

**2. [Rule 2 - Critical functionality] kb_connection creates relational tables defensively**
- **Found during:** Task 1
- **Issue:** `kb_items`/`kb_chunks` are owned by the Drizzle migration `0002_kb.sql` (a frontend plan, not yet written). The Rust `kb_connection` opens at app startup (Task 3) — potentially before the JS migration runs — and `index_item`/`query_chunks` would fail with "no such table".
- **Fix:** `ensure_relational_tables` creates `kb_items`/`kb_chunks` + indexes with `CREATE TABLE IF NOT EXISTS` (schema identical to 0002_kb.sql), so Rust works regardless of migration order; it is a no-op once Drizzle has run.
- **Files modified:** src-tauri/crates/nexusai-kb/src/store.rs
- **Committed in:** 731d013 (Task 1 commit)

**Total deviations:** 2 auto-fixed (Rule 3 build-flow correction + Rule 2 defensive schema). No scope change; the command surface matches the plan.

## Known Stubs

None. All six commands are fully implemented. The offline embedding test (`embed::tests::test_offline_embedding`) remains `#[ignore]`-gated pending a one-time online model download (criterion #5 — carried over from Plan 03-02, not introduced here).

## Notes / Next Plan Readiness

- The Rust side of Phase 3 is end-to-end: file/URL/note → ingest → chunk → embed → store with streamed progress, and `query_kb` returns fused citation chunks from the single shared index — all as registered Tauri commands.
- **Frontend plans (03-04/05/06)** consume `commands.*` from bindings.ts; reuse the chat Channel-handler pattern for `IndexProgress`.
- **`reindex_item` for URLs** re-reads from `source_path` via `parse_file` for files and the persisted `.md` for notes; URL items would need a re-fetch (currently treated like files — acceptable, no URL re-fetch on reindex). Flag for a future enhancement if URL freshness becomes a requirement.
- **First-run model download:** the first `import_file`/`query_kb` triggers the one-time fastembed model download into `app-data/kb-model-cache` (Pitfall 2) — the progress UI (Plan 03-05) should surface this.
- Regenerate bindings whenever KB command signatures change: `cd src-tauri && cargo run --bin export-bindings`.

---
*Phase: 03-knowledge-base-rag*
*Completed: 2026-06-27*

## Self-Check: PASSED

- progress.rs, store.rs, lib.rs (crate), src-tauri/src/lib.rs, export-bindings.rs, bindings.ts, 03-03-SUMMARY.md all exist on disk.
- Task commits 731d013, 62b3e27, fdb4e3a all present in git history.
