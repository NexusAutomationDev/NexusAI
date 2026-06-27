---
phase: 03-knowledge-base-rag
plan: 02
subsystem: database
tags: [sqlite-vec, fastembed, fts5, rrf, rusqlite, rag, embeddings, hybrid-search]

# Dependency graph
requires:
  - phase: 03-00
    provides: nexusai-kb crate scaffold, RED tests, pinned deps (sqlite-vec=0.1.9, rusqlite 0.31)
  - phase: 03-01
    provides: chunk.rs + ingest.rs (text → chunks feeding the embed/index pipeline)
provides:
  - "vector.rs: the single sqlite-vec module (D-16) — register, vec0 table, insert, KNN, delete"
  - "embed.rs: fastembed MultilingualE5Small (384-dim) local embeddings with E5 prefixes + global singleton"
  - "search.rs: FTS5 BM25 + RRF (k=60) hybrid_search wired to vector::knn"
affects: [03-03, 03-store, query_kb, agents, phase-07]

# Tech tracking
tech-stack:
  added: [fastembed 5.17.2, sqlite-vec 0.1.9, zerocopy 0.7.35, rusqlite 0.31 (bundled SQLite FTS5)]
  patterns: [sqlite-vec isolation behind one module (D-16), lazy_static+Mutex ONNX singleton, RRF rank-fusion]

key-files:
  created: []
  modified:
    - src-tauri/crates/nexusai-kb/src/vector.rs
    - src-tauri/crates/nexusai-kb/src/embed.rs
    - src-tauri/crates/nexusai-kb/src/search.rs

key-decisions:
  - "Used TextInitOptions (not the deprecated InitOptions alias) for fastembed 5.17"
  - "embed_passages/embed_query take &mut TextEmbedding — fastembed 5.17 embed() requires &mut self"
  - "global_model getter returns Arc<Mutex<TextEmbedding>> (Mutex needed for the &mut embed borrow)"
  - "RRF ties broken by ascending rowid for deterministic ordering across HashMap iteration"

patterns-established:
  - "D-16 isolation: only vector.rs imports sqlite_vec; every other module goes through its API"
  - "register_sqlite_vec() is an auto-extension — must be called BEFORE opening any KB connection"
  - "Hybrid retrieval fuses BM25 + vector by RANK (RRF), never by raw score (Pitfall 4)"

requirements-completed: [KB-02, KB-07]

# Metrics
duration: 11min
completed: 2026-06-27
---

# Phase 3 Plan 02: Retrieval Engine Summary

**Local fastembed E5 (384-dim PT-BR) embeddings, isolated sqlite-vec vec0 KNN, and FTS5 BM25 + RRF (k=60) hybrid search — the GREEN retrieval core for KB-02/KB-07.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-27T03:22:30Z
- **Completed:** 2026-06-27T03:33:21Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `vector.rs` is the SOLE sqlite-vec consumer (D-16): `register_sqlite_vec` (auto-extension transmute on rusqlite 0.31), `init_vec_table` (`vec0(embedding float[384])`), `insert_vector` (zerocopy `as_bytes`), `knn`, and `delete_vectors_for_rowids` for idempotent re-index (D-12). KNN round-trip test green.
- `embed.rs` loads `MultilingualE5Small` (384-dim, strong PT-BR per D-15) once via a `lazy_static` + `Mutex` singleton (`global_model`), embeds passages/queries with the required `passage: `/`query: ` E5 prefixes, all inference local (KB-07). Compiles; offline test stays `#[ignore]`.
- `search.rs` creates the `kb_fts` FTS5 external-content table (`unicode61` for PT-BR diacritics) with sync triggers, `bm25_search` (ordered by negative `bm25()` asc), the `reciprocal_rank_fusion` (k=60, rank-based, deterministic), and `hybrid_search` wiring BM25 + `vector::knn`. RRF determinism test green.

## Task Commits

Each task committed atomically (TDD where RED tests pre-existed from Plan 03-00):

1. **Task 1: sqlite-vec module (vector.rs) — D-16** - `93f3168` (feat)
2. **Task 2: Embeddings (embed.rs) — fastembed E5 PT-BR** - `421e101` (feat)
3. **Task 3: Hybrid search (search.rs) — FTS5 BM25 + RRF** - `40c7b58` (feat)

## Files Created/Modified
- `src-tauri/crates/nexusai-kb/src/vector.rs` - The single sqlite-vec module (load/table/insert/KNN/delete); KNN round-trip test.
- `src-tauri/crates/nexusai-kb/src/embed.rs` - fastembed E5 load/embed + `global_model` singleton getter for Plan 03-03.
- `src-tauri/crates/nexusai-kb/src/search.rs` - FTS5 BM25, RRF fusion, `hybrid_search` (the function `query_kb` will call).

## fastembed 5.17 API used (for Plan 03-03)
- **Init:** `TextEmbedding::try_new(TextInitOptions::new(EmbeddingModel::MultilingualE5Small).with_cache_dir(dir).with_show_download_progress(true))`. `InitOptions` is a **deprecated** alias for `TextInitOptions` in 5.17 — use `TextInitOptions` directly.
- **Embed:** `model.embed(Vec<String>, Option<usize>) -> anyhow::Result<Vec<Embedding>>` where `Embedding = Vec<f32>`. **Requires `&mut self`.**
- **Model getter for Plan 03-03:** `embed::global_model(cache_dir: &Path) -> anyhow::Result<Arc<Mutex<TextEmbedding>>>` — loads the ONNX model once; lock the `Mutex` per embed call (it needs `&mut`). Then `embed::embed_query(&mut *guard, q)` / `embed::embed_passages(&mut *guard, texts)`.
- **Offline test:** NOT run manually network-off in this plan (no pre-cached model in CI env). It compiles and stays `#[ignore]`, ready for a manual network-off run after a first online model download per criterion #5.

## Decisions Made
- **`TextInitOptions` over deprecated `InitOptions`** — the plan referenced `InitOptions::new`, but fastembed 5.17 deprecated that alias; `TextInitOptions` is the same builder with no warning.
- **`&mut TextEmbedding` signatures** — the plan/RED-test contract used `&TextEmbedding`, but `embed()` is `&mut self` in 5.17; embedding is impossible through a shared ref (see Deviations Rule 3).
- **`Arc<Mutex<TextEmbedding>>` singleton** — chosen over `OnceCell<TextEmbedding>` because the `&mut` requirement needs interior mutability; re-keys on `cache_dir` change for tests.
- **RRF tie-break by rowid** — `HashMap` iteration is non-deterministic, so equal fused scores are broken by ascending rowid to keep `hybrid_search` output stable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fastembed `embed()` requires `&mut self` — changed signatures + test**
- **Found during:** Task 2 (embed.rs)
- **Issue:** The contract (`embed_passages(model: &TextEmbedding, ...)`, `embed_query(model: &TextEmbedding, ...)`) and the Plan 03-00 RED test (`let model = ...; embed_passages(&model, ...)`) used shared references, but fastembed 5.17's `TextEmbedding::embed` takes `&mut self`. Embedding cannot compile through `&TextEmbedding`.
- **Fix:** Changed `embed_passages`/`embed_query` to take `&mut TextEmbedding`; updated the `#[ignore]` offline test to `let mut model` + `&mut model`; wrapped the singleton in `Mutex` so `global_model` callers get the mutable borrow.
- **Files modified:** src-tauri/crates/nexusai-kb/src/embed.rs
- **Verification:** `cargo build -p nexusai-kb` exits 0; `cargo test -p nexusai-kb embed --no-run` compiles the offline test.
- **Committed in:** 421e101 (Task 2 commit)

**2. [Rule 3 - Blocking] vector RED test opened the connection before registering the extension**
- **Found during:** Task 1 (vector.rs)
- **Issue:** The Plan 03-00 RED test did `Connection::open_in_memory(); register_sqlite_vec(); init_vec_table()`. `sqlite3_auto_extension` only applies to connections opened AFTER registration, so `init_vec_table` failed with `no such module: vec0`.
- **Fix:** Reordered the test to call `register_sqlite_vec()` BEFORE opening the connection — matching the documented "call once at startup before opening connections" contract.
- **Files modified:** src-tauri/crates/nexusai-kb/src/vector.rs (test only)
- **Verification:** `cargo test -p nexusai-kb vector` passes.
- **Committed in:** 93f3168 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking type/ordering issues against the alpha library's real API).
**Impact on plan:** Both fixes were forced by the actual fastembed 5.17 / sqlite-vec auto-extension semantics and do not change scope. The public surface still matches the plan intent (just `&mut` where required). No scope creep.

## Issues Encountered
- The full `cargo test -p nexusai-kb` run shows one unrelated failure: `store::tests::test_query_chunks_no_scoping` — that is a Plan 03-03 RED test (store.rs), explicitly out of scope here. All Plan 03-02 tests (vector, rrf) pass; chunk/ingest (Plan 03-01) also pass.

## User Setup Required
None - no external service configuration required. (First-time fastembed model download is a one-time online step handled by Plan 03-03's setup/progress UI; query-time retrieval is fully local — criterion #5.)

## Next Phase Readiness
- Retrieval engine is GREEN: Plan 03-03 can wire `query_kb` to `search::hybrid_search`, call `embed::global_model` + `embed_query` for the query vector, and call `vector::register_sqlite_vec` once in the Tauri setup hook before opening the KB connection.
- `search::init_fts_table` and `vector::init_vec_table` must be invoked during KB DB init (virtual tables live outside Drizzle migrations).
- Concern: the offline embedding test (criterion #5) is compiled but not yet executed network-off — run `cargo test -p nexusai-kb offline -- --ignored` once the model is cached before the phase gate.

---
*Phase: 03-knowledge-base-rag*
*Completed: 2026-06-27*

## Self-Check: PASSED
- vector.rs, embed.rs, search.rs, 03-02-SUMMARY.md all exist on disk.
- Task commits 93f3168, 421e101, 40c7b58 all present in git history.
