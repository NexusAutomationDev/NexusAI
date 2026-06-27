---
phase: 03-knowledge-base-rag
plan: 00
subsystem: testing
tags: [rust, fastembed, sqlite-vec, rusqlite, drizzle, vitest, rag, knowledge-base, tdd]

# Dependency graph
requires:
  - phase: 02-llm-chat
    provides: Drizzle migration pattern, Vitest setup, Channel streaming pattern, nexusai-chat Cargo deps to mirror
provides:
  - Phase 3 Cargo + npm dependencies installed and nexusai-kb compiles
  - KB relational schema (kb_folders, kb_items, kb_chunks) in Drizzle + 0002_kb.sql migration
  - Wave 0 RED tests for every KB requirement (KB-01..07) ready to be turned green
  - Rust module contract signatures (chunk, vector, search, ingest, embed, store)
  - Deterministic test fixtures (sample.md, sample.txt, article.html)
affects: [03-01, 03-02, 03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: [fastembed 5.17.2, sqlite-vec 0.1.9, rusqlite 0.31, zerocopy 0.7.35, pdf-extract 0.10.0, docx-rust 0.1.11, dom_smoothie 0.18.0, "@uiw/react-codemirror 4.25.10", "@codemirror/lang-markdown 6.5.0", "@tanstack/react-table 8.21.3", react-arborist 3.10.5, sonner 2.0.7]
  patterns: [Nyquist RED-test gate, single sqlite-vec module isolation (D-16), contract-signature stubs with unimplemented!()]

key-files:
  created: [src-tauri/crates/nexusai-kb/src/chunk.rs, src-tauri/crates/nexusai-kb/src/vector.rs, src-tauri/crates/nexusai-kb/src/search.rs, src-tauri/crates/nexusai-kb/src/ingest.rs, src-tauri/crates/nexusai-kb/src/embed.rs, src-tauri/crates/nexusai-kb/src/store.rs, src/lib/db/migrations/0002_kb.sql, tests/kb-indexing-store.test.ts, tests/kb-items-table.test.tsx, tests/kb-notes-editor.test.tsx]
  modified: [src-tauri/crates/nexusai-kb/Cargo.toml, src-tauri/crates/nexusai-kb/src/lib.rs, src/lib/db/schema.ts, package.json]

key-decisions:
  - "Pinned sqlite-vec=0.1.9 instead of 0.1.10-alpha.4 — the alpha ships a broken build (#includes missing sqlite-vec-diskann.c)"
  - "Migration registration is automatic via import.meta.glob in proxy.ts — no explicit filename entry needed"
  - "dom_smoothie resolved to 0.18.0 (plan's 0.10 does not exist); pdf-extract 0.10.0, docx-rust 0.1.11"

patterns-established:
  - "Nyquist RED gate: every KB-XX requirement has a failing test before any implementation plan runs"
  - "Rust contract stubs: pub fn signatures with unimplemented!() so the crate compiles while tests fail RED"
  - "sqlite-vec stays isolated in vector.rs (D-16) — nothing else imports sqlite_vec"

requirements-completed: [KB-01, KB-02, KB-03, KB-04, KB-05, KB-06, KB-07]

# Metrics
duration: 10min
completed: 2026-06-27
---

# Phase 3 Plan 00: Foundation + Wave 0 RED Tests Summary

**Installed all Phase 3 Cargo/npm dependencies, defined the KB SQLite schema (Drizzle + 0002_kb.sql), and authored failing RED tests covering every KB requirement so downstream plans have a Nyquist gate to turn green.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-27T03:10:47Z
- **Completed:** 2026-06-27T03:20:49Z
- **Tasks:** 3
- **Files modified/created:** 19

## Accomplishments
- `nexusai-kb` crate now carries fastembed, sqlite-vec, rusqlite, zerocopy, pdf-extract, docx-rust, dom_smoothie + specta, and compiles clean (`cargo build -p nexusai-kb` exits 0).
- Frontend deps for the KB UI installed: @uiw/react-codemirror, @codemirror/lang-markdown, @tanstack/react-table, react-arborist, sonner.
- KB relational schema (kb_folders, kb_items, kb_chunks) added to `schema.ts` with full CHECK constraints + indexes, and committed as migration `0002_kb.sql` (auto-registered via `import.meta.glob`).
- 7 Rust RED tests (1 `#[ignore]` offline) + 3 frontend RED suites authored — all failing as expected, one per KB requirement.

## Task Commits

1. **Task 1: Install deps + KB schema/migration** — `a5f2480` (build)
2. **Task 2: Rust Wave 0 RED tests + fixtures** — `704b6fa` (test)
3. **Task 3: Frontend Wave 0 RED tests** — `45ffcaf` (test)

## Files Created/Modified
- `src-tauri/crates/nexusai-kb/Cargo.toml` — Phase 3 Rust deps (sqlite-vec pinned 0.1.9, rusqlite locked at 0.31)
- `src-tauri/crates/nexusai-kb/src/lib.rs` — module declarations (chunk/vector/search/ingest/embed/store)
- `src-tauri/crates/nexusai-kb/src/chunk.rs` — `Chunk` + `chunk_text` contract; 3 RED tests (KB-01)
- `src-tauri/crates/nexusai-kb/src/vector.rs` — single sqlite-vec module contract; KNN roundtrip RED test (KB-02, D-16)
- `src-tauri/crates/nexusai-kb/src/search.rs` — `reciprocal_rank_fusion` contract; deterministic RRF RED test (KB-02)
- `src-tauri/crates/nexusai-kb/src/ingest.rs` — `extract_article` contract; chrome-stripping RED test (KB-04)
- `src-tauri/crates/nexusai-kb/src/embed.rs` — fastembed contract; offline embedding `#[ignore]` test (KB-07)
- `src-tauri/crates/nexusai-kb/src/store.rs` — `query_chunks`/`Citation` contract; no-scoping RED test (KB-06)
- `src-tauri/crates/nexusai-kb/tests/fixtures/{sample.md,sample.txt,article.html}` — deterministic PT-BR fixtures
- `src/lib/db/schema.ts` — kbFolders/kbItems/kbChunks Drizzle tables + types
- `src/lib/db/migrations/0002_kb.sql` — KB relational migration
- `tests/kb-indexing-store.test.ts` — D-11 store transitions (RED)
- `tests/kb-items-table.test.tsx` — D-09/D-10 faceted filter + PT-BR empty copy (RED)
- `tests/kb-notes-editor.test.tsx` — D-08 no-mutation invariant (RED)
- `package.json` — frontend KB deps

## Resolved Dependency Versions (per plan output requirement)
- **sqlite-vec:** `0.1.9` (downgraded from plan's `0.1.10-alpha.4` — see deviation)
- **pdf-extract:** `0.10.0`
- **docx-rust:** `0.1.11`
- **dom_smoothie:** `0.18.0` (plan's `0.10` does not exist on crates.io; latest is 0.18.0)
- **fastembed:** `5.17.2`, **rusqlite:** `0.31.0`, **zerocopy:** `0.7.35`
- **Migration registration file:** `src/lib/db/proxy.ts` — uses `import.meta.glob('./migrations/*.sql', { eager: true })` with sorted keys, so `0002_kb.sql` is picked up automatically in version order (no explicit filename entry exists or is needed).

## Decisions Made
- **sqlite-vec 0.1.9 over 0.1.10-alpha.4:** The pinned alpha fails to build — its `sqlite-vec.c` `#include`s `sqlite-vec-diskann.c`, which is not shipped in the published crate (packaging bug). 0.1.9 predates the diskann feature, builds cleanly, and exposes the identical vec0 API used by `vector.rs`.
- **dom_smoothie 0.18.0:** Plan specified `0.10`, which has never been published (versions jump 0.x → 0.18.0). Used the latest published version per the plan's explicit fallback instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sqlite-vec 0.1.10-alpha.4 fails to compile**
- **Found during:** Task 1 (Install dependencies)
- **Issue:** `cargo build -p nexusai-kb` failed with `fatal error C1083: Cannot open include file: 'sqlite-vec-diskann.c'`. The published `0.1.10-alpha.4` crate's `sqlite-vec.c` references a diskann source file that is absent from the package — a packaging bug in the alpha.
- **Fix:** Pinned `sqlite-vec = "=0.1.9"` (last stable, predates diskann). Added an explanatory comment in `Cargo.toml`. The `rusqlite=0.31` pin and the `sqlite3_auto_extension` transmute approach (Pitfall 1) remain valid for 0.1.9.
- **Files modified:** `src-tauri/crates/nexusai-kb/Cargo.toml`
- **Verification:** `cargo build -p nexusai-kb` exits 0; `cargo test -p nexusai-kb` runs the harness (RED).
- **Committed in:** `a5f2480` (Task 1 commit)

**2. [Rule 3 - Blocking] dom_smoothie 0.10 does not exist**
- **Found during:** Task 1 (Install dependencies)
- **Issue:** Plan/research specified `dom_smoothie = "0.10"`; `cargo search` shows the latest (and only relevant) version is `0.18.0`.
- **Fix:** Used `dom_smoothie = "0.18"` per the plan's explicit fallback ("if 0.10 does not resolve, use the latest published version").
- **Files modified:** `src-tauri/crates/nexusai-kb/Cargo.toml`
- **Verification:** `dom_smoothie v0.18.0` compiled successfully in the build.
- **Committed in:** `a5f2480` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both were unavoidable registry/packaging realities. No scope creep. The downgraded sqlite-vec keeps the exact vec0 contract the implementation plans rely on; the diskann feature was never used.

## Issues Encountered
- Git emits CRLF/LF line-ending warnings on commit (cosmetic, autocrlf). No functional impact.

## Known Stubs
All Rust module functions are intentional contract stubs (`unimplemented!()`) and all frontend test imports target not-yet-built modules. These are the deliberate RED state of this Nyquist-gate plan — they are turned green by:
- `chunk.rs`, `ingest.rs` → Plan 03-01
- `vector.rs`, `search.rs`, `embed.rs` → Plan 03-02
- `store.rs` (`query_chunks`) → Plan 03-03
- `stores/indexing`, `ItemsTable` → Plan 03-04
- `NoteEditor` → Plan 03-05

No stub is a hidden gap; each is tracked above and in `03-VALIDATION.md`'s Per-Task Verification Map.

## User Setup Required
None — no external service configuration required. (First-time fastembed model download is handled in Plan 03-02.)

## Next Phase Readiness
- Workspace compiles; RED suite confirmed failing across all KB requirements.
- `wave_0_complete` in `03-VALIDATION.md` can flip to `true` (RED suite confirmed).
- Waves 2-4 implementation plans can proceed — each has a pre-existing failing test to turn green.

## Self-Check: PASSED

All created files verified present on disk; all three task commits (`a5f2480`, `704b6fa`, `45ffcaf`) verified in git history.

---
*Phase: 03-knowledge-base-rag*
*Completed: 2026-06-27*
