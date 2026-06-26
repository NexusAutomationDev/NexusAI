---
phase: "01"
plan: "04"
subsystem: appearance-ui + channel-api
tags: [zustand, tauri-plugin-store, appearance, streaming, channel-api, rust, react, tdd]
dependency_graph:
  requires: [01-03]
  provides: [appearance-store, appearance-section, stream-event-type, channel-api-pattern]
  affects: [all-phase-02-streaming, settings-ui-complete]
tech_stack:
  added: []
  patterns:
    - useAppearance Zustand store with DOM mutations (.dark class, --font-scale CSS var, data-accent attr)
    - tauri-plugin-store persistence via load('appearance.json', { autoSave: true })
    - StreamEvent serde(tag="event", content="data") pattern for JS-compatible Channel events
    - Channel<StreamEvent> in Rust commands — NOT app.emit() (avoids wry memory leak)
    - Inner mod commands pattern preserved for rustc 1.96 + specta macro compatibility
key_files:
  created:
    - src/lib/stores/appearance.ts
    - src/components/settings/AppearanceSection.tsx
    - src/lib/bindings.ts
  modified:
    - src/routes/settings/appearance.tsx
    - src/main.tsx
    - src-tauri/crates/nexusai-settings/src/lib.rs
    - src-tauri/crates/nexusai-settings/Cargo.toml
    - tests/appearance.test.ts
    - tests/channel.test.ts
    - pnpm-workspace.yaml
decisions:
  - "ToggleButton implemented as plain button (aria-pressed) instead of @radix-ui/react-toggle — toggle not in package.json dependencies; avoids adding a new package for a 20-line pattern"
  - "stream_llm_demo registered via nexusai_settings::invoke_handler() delegation — consistent with inner module pattern from Plan 01-01; no direct listing in src-tauri/src/lib.rs needed"
  - "pnpm-workspace.yaml allowBuilds set to true for @biomejs/biome and esbuild — required for vitest to run in this worktree"
metrics:
  duration: "12 minutes"
  completed_date: "2026-06-26"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 8
---

# Phase 01 Plan 04: Appearance Section + Channel API Summary

Zustand appearance store with DOM mutations for theme/font-scale/accent persisted via tauri-plugin-store, AppearanceSection UI with 5 color swatches and pt-BR copy, and canonical Channel<StreamEvent> streaming pattern in Rust with stream_llm_demo demo command.

## What Was Built

### Task 1: Appearance Store + AppearanceSection (FOUND-03, D-07, D-08, D-09)

- `src/lib/stores/appearance.ts`: Zustand store (`useAppearance`) with:
  - `setTheme(t)`: toggles `.dark` class on `document.documentElement` (dark/light/system)
  - `setFontScale(s)`: sets `--font-scale` CSS variable (`0.875` / `1` / `1.125`)
  - `setAccentColor(c)`: sets `data-accent` attribute on `<html>`
  - `load()`: restores all three settings from `appearance.json` before React mounts
  - `ACCENT_COLORS`: 5 entries (violet/blue/green/orange/red) with exact HSL values from UI-SPEC
  - Persistence via `@tauri-apps/plugin-store` with `autoSave: true`
- `src/components/settings/AppearanceSection.tsx`: 3 controls per D-07:
  - Theme toggle: "Claro" / "Escuro" buttons (ToggleButton with aria-pressed)
  - Font scale: "Pequeno" / "Médio" / "Grande" buttons
  - Accent color: 5 circular swatches from ACCENT_COLORS (D-08)
- `src/routes/settings/appearance.tsx`: replaced placeholder with AppearanceSection
- `src/main.tsx`: calls `useAppearance.getState().load()` before React mounts (D-09)
- `tests/appearance.test.ts`: 9 real assertions replacing 3 placeholders — all pass

### Task 2: Channel API Streaming Pattern (FOUND-05)

- `src-tauri/crates/nexusai-settings/src/lib.rs`:
  - Added `StreamEvent` enum with `#[serde(rename_all = "camelCase", tag = "event", content = "data")]` — required for TypeScript Channel consumer `{ event: 'token', data: { text } }` shape
  - Added `stream_llm_demo` async command using `Channel<StreamEvent>` — splits prompt into words, sends one `Token` per word, ends with `Done`
  - Both added to `invoke_handler()` and `collect()` inside `mod commands`
- `src-tauri/crates/nexusai-settings/Cargo.toml`: added `tokio` workspace dependency
- `src/lib/bindings.ts`: TypeScript bindings stub with `StreamEvent` union type and `streamLlmDemo` function (overwritten by tauri-specta on `pnpm tauri dev`)
- `tests/channel.test.ts`: 6 real assertions replacing 2 placeholders — all pass

## Verification

```
pnpm vitest run → 7 test files, 31 tests, all passed, exit 0
cargo check → 0 errors
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing dependency] ToggleButton implemented as plain button instead of @radix-ui/react-toggle**
- **Found during:** Task 1 — AppearanceSection implementation
- **Issue:** Plan's AppearanceSection used `import { Toggle } from '../ui/toggle'` but `toggle.tsx` component and `@radix-ui/react-toggle` dependency were not in package.json or src/components/ui/
- **Fix:** Implemented `ToggleButton` as a local button element with `aria-pressed`, `border-primary bg-primary/10` active state styling from shadcn/ui conventions. Same visual and accessibility result without adding a dependency.
- **Files modified:** `src/components/settings/AppearanceSection.tsx`
- **Commit:** 52e96d8

**2. [Rule 3 - Blocking] pnpm build scripts blocked by allowBuilds**
- **Found during:** Task 1 verification (vitest run failed)
- **Issue:** `pnpm-workspace.yaml` had `allowBuilds` entries set to `'set this to true or false'` string, blocking esbuild and @biomejs/biome from running their postinstall scripts, which caused vitest to fail
- **Fix:** Set both `allowBuilds` entries to `true` in `pnpm-workspace.yaml`, ran `pnpm install`
- **Files modified:** `pnpm-workspace.yaml`
- **Commit:** d7329be

## Known Stubs

| File | Stub | Resolved by |
|------|------|-------------|
| src/lib/bindings.ts | Hand-written stub; actual file regenerated by tauri-specta on `pnpm tauri dev` | Every `tauri dev` run auto-overwrites |
| stream_llm_demo | Simulates streaming with 50ms sleep per word; Phase 2 replaces with real reqwest LLM streaming | Phase 2 |

## Phase 2 Requirements (from threat model)

- **T-01-04-01 (DoS):** Phase 2 real LLM streaming must add a max-token guard — `stream_llm_demo` is bounded by prompt word count but real streaming is not
- **T-01-04-04 (XSS):** Phase 2 must sanitize token text before rendering via `innerHTML` — demo tokens come from Rust (safe), production tokens come from external LLM APIs (unsafe)

## Threat Flags

None. No new network endpoints beyond those in the plan's threat model. Channel API uses `on_event.send()` not `app.emit()` — T-01-04-02 mitigated.

## Self-Check: PASSED

Files exist:
- src/lib/stores/appearance.ts: FOUND
- src/components/settings/AppearanceSection.tsx: FOUND
- src/lib/bindings.ts: FOUND
- src/routes/settings/appearance.tsx: FOUND (updated)
- src/main.tsx: FOUND (updated)
- src-tauri/crates/nexusai-settings/src/lib.rs: FOUND (updated)

Commits exist:
- d7329be: FOUND (RED appearance tests)
- 52e96d8: FOUND (GREEN appearance store + UI)
- 13d7201: FOUND (RED channel tests)
- ceed20a: FOUND (GREEN Channel API)

Test suite: `pnpm vitest run` exits 0, 31/31 tests passing
Cargo check: 0 errors
