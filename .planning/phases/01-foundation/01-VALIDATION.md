---
phase: 1
slug: foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `vitest.config.ts` — Wave 0 gap |
| **Quick run command** | `pnpm vitest run --reporter=dot` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=dot`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FOUND-01 | JS exfiltration (keychain) | `get_api_key_status` returns `{configured: bool}` only — never the raw key | unit (mocked IPC) | `pnpm vitest run tests/api-keys.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | FOUND-02 | — | N/A | unit (Zustand store) | `pnpm vitest run tests/settings-store.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | FOUND-03 | — | N/A | unit (jsdom) | `pnpm vitest run tests/appearance.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | FOUND-04 | — | N/A | unit (React Testing Library) | `pnpm vitest run tests/routes.test.tsx` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 2 | FOUND-05 | — | N/A | unit (mockIPC channel) | `pnpm vitest run tests/channel.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 2 | FOUND-06 | — | N/A | unit (mocked IPC) | `pnpm vitest run tests/db-proxy.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-07 | 01 | 3 | FOUND-07 | signing key leak | `TAURI_SIGNING_PRIVATE_KEY` never echoed in CI logs | smoke (config parse) | `pnpm vitest run tests/config.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-08 | 01 | 3 | FOUND-08 | YAML injection | Actions pinned to SHA; no PAT in env | CI | `act -j build --dry-run` or manual | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest config with jsdom environment
- [ ] `tests/setup.ts` — `mockIPC` + `clearMocks` shared fixture for all tests
- [ ] `tests/api-keys.test.ts` — FOUND-01: `get_api_key_status` returns `{configured: bool}`, never raw key
- [ ] `tests/settings-store.test.ts` — FOUND-02: model selection Zustand store roundtrip
- [ ] `tests/appearance.test.ts` — FOUND-03: theme toggle applies `.dark` to `<html>`; font scale sets `--font-scale` CSS var
- [ ] `tests/routes.test.tsx` — FOUND-04: all module stub routes render without crash
- [ ] `tests/channel.test.ts` — FOUND-05: Channel `onmessage` receives token events in order
- [ ] `tests/db-proxy.test.ts` — FOUND-06: Drizzle proxy routes SELECT through mocked `plugin:sql|select`
- [ ] `tests/config.test.ts` — FOUND-07: `tauri.conf.json` contains non-empty `updater.pubkey` field
- [ ] Framework install: `pnpm add -D vitest @testing-library/react @testing-library/user-event jsdom @tauri-apps/api`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OS Keychain read/write roundtrip | FOUND-01 | Requires macOS Keychain / Windows Credential Manager hardware — cannot mock end-to-end | On macOS/Windows dev machine: run app, enter API key, restart app, verify key still configured |
| Streaming memory stability (10 min session) | FOUND-05 | Requires real LLM provider + live webview + memory profiler | Open DevTools, start streaming session, watch heap growth over 10 min; accept < 10 MB growth |
| Distributable build produces installable artifact | FOUND-08 | Requires macOS/Windows runner + code-signing flow | CI artifact download: verify installer opens and app launches on target OS |
| Light/dark theme persists across restart | FOUND-03 | Requires real app restart (not hot reload) | Set dark mode, quit app, reopen, confirm `.dark` class still on `<html>` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
