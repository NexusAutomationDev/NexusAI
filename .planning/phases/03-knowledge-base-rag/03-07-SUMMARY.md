---
phase: 03-knowledge-base-rag
plan: 07
subsystem: verification
tags: [checkpoint, human-verify, smoke-test, rag, kb]

# Dependency graph
requires:
  - phase: 03-knowledge-base-rag
    plan: 05
    provides: KB notes editor + /kb two-pane route
  - phase: 03-knowledge-base-rag
    plan: 06
    provides: RAG-grounded chat with citations
provides:
  - "Human sign-off on the full Phase 3 KB + RAG loop (success criteria #1–#5)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

# Outcome
outcome: approved
---

# 03-07 — Human Smoke-Test Checkpoint

**Outcome: APPROVED** — user verified the full Phase 3 KB + RAG loop end-to-end on 2026-06-27.

## Task 1 — Pre-checkpoint automated sweep

| Check | Result |
|-------|--------|
| `cargo test --workspace` | ✅ 8 passed + 1 ignored (offline) |
| `pnpm run test` | ✅ 87 passed (15 files) |
| `pnpm run build` | ✅ green (chunk-size warning only) |

The sweep initially surfaced 5 pre-existing (Phases 1–2) defects blocking the gate; all were fixed
before the human checkpoint — see Deviations.

## Task 2 — Human smoke test (6 manual verifications)

| # | Requirement | Result |
|---|-------------|--------|
| 1 | KB-01 + KB-02 — file import → RAG answer + citation | ✅ OK |
| 2 | KB-04 — URL scraped, indexed, queryable | ✅ OK |
| 3 | KB-03 — note create/edit fidelity (no mutation) + retrieval | ✅ OK |
| 4 | KB-05 — browser shows files/notes/URLs with status, facets, tree | ✅ OK |
| 5 | KB-07 / criterion #5 — embeddings work offline against indexed content | ✅ OK |
| 6 | KB-06 — single shared index, no per-agent scoping | ✅ OK |

## Deviations (fixes applied during the checkpoint, all real gaps that automated tests could not catch)

1. **pnpm enforced (build/deps):** Plan 03-00 installed deps via `npm` (updated `package-lock.json`). Re-synced `pnpm-lock.yaml`, removed `package-lock.json`, gitignored it, pinned `packageManager: pnpm@10.33.2`. (`0cdda52`, `a1d3eee`)
2. **Pre-existing tsc errors + stale test (build):** Fixed 4 Phase-1/2 tsc errors (`chat.ts` unused var, `appearance.ts`/`settings.ts` Store `defaults`, `chat/route.tsx` `direction`→`orientation`) and removed the obsolete `streamLlmDemo` channel test. (`aea8d32`)
3. **`default-run` (build):** 03-03's `export-bindings` helper bin made bare `cargo run` (used by `tauri dev`) ambiguous — pinned `default-run = "nexusai"`. (`d200ba9`)
4. **Dialog + fs plugin wiring (runtime):** `dialog:allow-open` capability was missing (file picker failed); `tauri-plugin-fs` had only the npm package — the Rust crate was never added/registered (note reading would fail). Added both + scoped `$APPDATA` read perms. (`a89db8b`)
5. **Add-knowledge UX (KB-01/03/05):** The import affordance existed only in the empty state and "Nova nota" was never wired to any UI. Added a persistent compact toolbar (files + URL) above the items table and a "Nova nota" button (tree header + toolbar + empty state). (`15e87bd`)

## Verdict

All six Phase 3 success criteria confirmed by the user. Phase gate cleared — ready for phase verification.
