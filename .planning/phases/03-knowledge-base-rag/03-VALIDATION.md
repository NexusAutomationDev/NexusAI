---
phase: 3
slug: knowledge-base-rag
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (frontend) + `cargo test` (Rust `nexusai-kb`) |
| **Config file** | `vitest.config.ts` (jsdom, globals, `tests/setup.ts`) |
| **Quick run command** | `npm run test` (frontend) / `cargo test -p nexusai-kb` (Rust) |
| **Full suite command** | `npm run test && cargo test --workspace` |
| **Estimated runtime** | ~30 seconds (excludes `--ignored` offline embedding test) |

---

## Sampling Rate

- **After every task commit:** Run `cargo test -p nexusai-kb` (Rust touched) and/or `npm run test -- <kb file>` (frontend touched)
- **After every plan wave:** Run `npm run test && cargo test --workspace`
- **Before `/gsd:verify-work`:** Full suite green + offline embedding test (criterion #5) passing
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | KB-01 | unit (Rust) | `cargo test -p nexusai-kb chunk` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | KB-02 | unit (Rust) | `cargo test -p nexusai-kb rrf` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | KB-02 | unit (Rust, in-mem db) | `cargo test -p nexusai-kb vector` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | KB-03 | component (Vitest) | `npm run test -- kb-notes-editor` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | KB-04 | unit (Rust) | `cargo test -p nexusai-kb scrape` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | KB-05 | component (Vitest) | `npm run test -- kb-items-table` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | KB-05 | component (Vitest) | `npm run test -- kb-indexing-store` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | KB-06 | unit (Rust) | `cargo test -p nexusai-kb query` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | KB-07 | integration (Rust, network-off) | `cargo test -p nexusai-kb offline -- --ignored` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs assigned by the planner; every KB-XX requirement above maps to at least one task.*

---

## Wave 0 Requirements

- [ ] `src-tauri/crates/nexusai-kb/src/chunk.rs` tests — KB-01 chunk boundaries/size/overlap
- [ ] `src-tauri/crates/nexusai-kb/src/vector.rs` test — KB-02 sqlite-vec in-memory KNN round-trip
- [ ] `src-tauri/crates/nexusai-kb/src/search.rs` test — KB-02 RRF determinism + FTS5 bm25 ordering
- [ ] `src-tauri/crates/nexusai-kb/src/ingest.rs` test — KB-04 dom_smoothie HTML fixture extraction
- [ ] `src-tauri/crates/nexusai-kb/src/embed.rs` offline integration test — KB-07 / criterion #5 (`#[ignore]`-gated)
- [ ] `tests/kb-indexing-store.test.ts` — D-11 store transitions (pending→indexing→indexed→failed)
- [ ] `tests/kb-items-table.test.tsx` — D-09/D-10 faceted filters
- [ ] `tests/kb-notes-editor.test.tsx` — D-08 no-mutation invariant
- [ ] `src-tauri/crates/nexusai-kb/tests/fixtures/` — tiny sample PDF/DOCX/MD/TXT + a saved HTML page for deterministic, offline tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end RAG answer cites the correct source chunk | KB-02 / criterion #1 | Requires a live cloud LLM call + human judgment of answer relevance | Import a known PDF, ask a question whose answer is in it, confirm the answer + that the `[n]` citation/source card points to the right chunk |
| Inline `[n]` citation fidelity (vs source-cards fallback D-06) | KB-02 | LLM citation-ID emission quality is judged, not asserted | Run several grounded queries, confirm citation markers map to real chunks; if weak, confirm D-06 source-cards fallback renders |
| URL "queryable within one minute" | KB-04 / criterion #3 | Wall-clock UX bound depends on network + page size | Paste a real article URL, confirm it becomes queryable and a toast confirms completion |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
