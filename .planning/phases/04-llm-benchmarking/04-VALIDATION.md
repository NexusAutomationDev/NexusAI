---
phase: 4
slug: llm-benchmarking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vitest.config.ts` (established Phase 1) |
| **Quick run command** | `pnpm test --run` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run`
- **After every plan wave:** Run `pnpm test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-00-01 | 00 | 0 | BENCH-01 | — | N/A | unit stub | `pnpm test --run src/test/bench-01.test.ts` | ❌ W0 | ⬜ pending |
| 04-00-02 | 00 | 0 | BENCH-02 | — | N/A | unit stub | `pnpm test --run src/test/bench-02.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-01 | 01 | 1 | BENCH-01 | — | N/A | unit | `pnpm test --run` | ✅ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | BENCH-01 | — | N/A | unit | `pnpm test --run` | ✅ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | BENCH-01 | — | N/A | unit | `pnpm test --run` | ✅ W0 | ⬜ pending |
| 04-04-01 | 04 | 4 | BENCH-02 | — | N/A | unit | `pnpm test --run` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/bench-01.test.ts` — RED stubs for BENCH-01 (parallel streams arrive independently)
- [ ] `src/test/bench-02.test.ts` — RED stubs for BENCH-02 (score persisted, visible in history)
- [ ] `src/test/benchmark-store.test.ts` — Zustand benchmarkStore unit tests (session init, column state, winner state)
- [ ] `src/test/benchmark-schema.test.ts` — Drizzle schema migration smoke test (tables created, FK integrity)

*Existing Vitest infrastructure covers all infra needs — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Parallel streaming columns render tokens independently without visual jitter | BENCH-01 | Requires visual observation of live streaming | Open benchmark, select 2+ models, run prompt, observe each column streaming independently |
| ToggleGroup enables automatically when last stream completes | BENCH-01 | DOM timing behavior, not easily unit-testable | Run benchmark, wait for all streams to finish, verify scoring bar becomes enabled without interaction |
| Collapsed column (collapsedSize=4%) shows only header | BENCH-01 | Visual / CSS behavior | Collapse a column via resize handle, verify header still visible at ~4% width |
| Winner badge appears correctly in history table | BENCH-02 | Requires E2E flow (run → score → navigate to history) | Run benchmark, score winner, open History tab, verify row shows correct winner badge |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
