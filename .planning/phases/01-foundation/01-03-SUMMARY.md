---
phase: "01"
plan: "03"
subsystem: settings-ui
tags: [settings, api-keys, models, zustand, tauri-plugin-store, shadcn-ui, react, tdd]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [settings-nav, api-keys-section, models-section, settings-store]
  affects: [all-future-phases-using-api-keys, all-future-phases-using-models]
tech_stack:
  added:
    - "@radix-ui/react-label@2.1.10"
    - "@radix-ui/react-separator@1.1.10"
    - "@radix-ui/react-select@2.3.1"
    - "@radix-ui/react-slot@1.3.0"
    - shadcn-style: button, input, label, badge, separator, select (hand-crafted, not CLI-installed)
  patterns:
    - useApiKeyState hook encapsulates per-provider editing/delete state
    - tauri-plugin-store singleton via module-level _store variable with lazy init
    - type="password" input always disabled except during active edit session
    - Inline destructive confirmation (no modal) for delete flow
key_files:
  created:
    - src/components/settings/SettingsNav.tsx
    - src/components/settings/ApiKeysSection.tsx
    - src/components/settings/ModelsSection.tsx
    - src/lib/stores/settings.ts
    - src/routes/settings/api-keys.tsx
    - src/routes/settings/models.tsx
    - src/routes/settings/appearance.tsx
    - src/components/ui/button.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/separator.tsx
    - src/components/ui/select.tsx
  modified:
    - src/routes/settings/index.tsx (replaced placeholder nav with SettingsNav, added redirect)
    - tests/api-keys.test.ts (added component-level password input assertion)
    - tests/settings-store.test.ts (replaced placeholders with real store assertions)
    - package.json (added 4 Radix UI packages)
    - pnpm-lock.yaml
decisions:
  - "Hand-crafted shadcn/ui components instead of CLI install — shadcn CLI requires an interactive terminal and components.json setup not yet done; hand-crafting the same output is equivalent and avoids CI/CD dependency on interactive CLI"
  - "Module-level _store singleton for tauri-plugin-store — avoids creating a new store handle per Zustand action call; lazy init ensures it only connects when first needed"
  - "useApiKeyState hook per provider — isolates state machine (editing/confirmDelete/error) per row; clean separation from the rendering concern in ApiKeyRow"
  - "Appearance route is a stub — full implementation deferred to Plan 04 as documented in plan"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-06-26"
  tasks_completed: 2
  tasks_total: 2
  files_created: 13
  files_modified: 5
---

# Phase 01 Plan 03: Settings UI Summary

Settings page with 160px sub-nav (Chaves de API / Modelos / Aparência), masked API key management with Editar/Salvar/Remover flow calling Tauri IPC, and Zustand model selection store persisting to settings.json via tauri-plugin-store.

## What Was Built

### Task 1: Settings sub-nav + API key management UI (FOUND-01)

- `SettingsNav` — 160px sidebar nav with 3 pt-BR sections: "Chaves de API", "Modelos", "Aparência". Active route highlighted via `useRouterState`.
- `ApiKeysSection` — one `ApiKeyRow` per provider (OpenAI, OpenRouter, Gemini):
  - Input: `type="password"`, disabled by default; enabled only during edit session
  - "Editar" button activates edit mode, clears input
  - "Salvar chave" invokes `set_api_key` IPC then sets `configured: true` in local state
  - "Remover chave" shows inline confirmation: "Confirmar remoção" / "Manter chave"
  - Badge shows "Configurado" (green) / "Não configurado" (red)
  - `get_api_key_status` used for status check on mount — raw key NEVER returned to JS
- Settings sub-routes: `/settings/api-keys`, `/settings/models`, `/settings/appearance`
- Settings `index.tsx` now redirects `/settings` → `/settings/api-keys` and uses `SettingsNav`
- shadcn-style UI components created: button, input, label, badge, separator, select

### Task 2: Model selection store + Models settings section (FOUND-02)

- `src/lib/stores/settings.ts` — Zustand store with `chatModel`, `agentsModel`, `benchmarkModel`:
  - Default: `gpt-4o` for all three
  - Each setter calls `tauri-plugin-store` `.set()` before updating Zustand state
  - `load()` action rehydrates all three from `settings.json` on app startup
  - `autoSave: true` on the store handle ensures writes are flushed
- `ModelsSection` — 3 `Select` dropdowns (Chat, Agentes, Benchmark) wired to store actions
- 8 model options covering OpenAI, OpenRouter, and Gemini providers

## Verification

```
pnpm vitest run → 7 test files, 21 tests, all passed, exit 0

Acceptance checks:
- grep -q "Chaves de API" SettingsNav.tsx → PASS
- grep -q "Modelos" SettingsNav.tsx → PASS
- grep -q "Aparência" SettingsNav.tsx → PASS
- grep -q 'type="password"' ApiKeysSection.tsx → PASS
- grep -q "Editar" ApiKeysSection.tsx → PASS
- grep -q "Salvar chave" ApiKeysSection.tsx → PASS
- grep -q "Configurado" ApiKeysSection.tsx → PASS
- grep -q "Não configurado" ApiKeysSection.tsx → PASS
- grep -q "Confirmar remoção" ApiKeysSection.tsx → PASS
- grep -q "Manter chave" ApiKeysSection.tsx → PASS
- grep -q "get_api_key_status" ApiKeysSection.tsx → PASS
- grep -q "set_api_key" ApiKeysSection.tsx → PASS
- grep -q "delete_api_key" ApiKeysSection.tsx → PASS
- grep -q "get_api_key\b" ApiKeysSection.tsx → 0 results (PASS — no raw key getter)
- grep -q "settings.json" stores/settings.ts → PASS
- grep -q "autoSave.*true" stores/settings.ts → PASS
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn/ui CLI not available — components hand-crafted**
- **Found during:** Task 1 setup
- **Issue:** The plan references shadcn/ui components (button, input, etc.) as available via `shadcn add`. However, `components.json` does not exist (shadcn not initialized via CLI yet), and running `pnpm dlx shadcn@latest add button` in a non-interactive CI environment requires interactive prompts. The tooltip.tsx from Plan 02 was also hand-crafted.
- **Fix:** Wrote the 6 required components (button, input, label, badge, separator, select) directly as idiomatic shadcn/ui Radix-based implementations matching the exact shadcn source. Installed the 4 missing Radix UI packages (`@radix-ui/react-label`, `react-separator`, `react-select`, `react-slot`) via pnpm. The output is functionally identical to `shadcn add`.
- **Files modified:** `src/components/ui/{button,input,label,badge,separator,select}.tsx`, `package.json`, `pnpm-lock.yaml`
- **Commits:** 481c6c8

## Known Stubs

| File | Stub | Resolved by |
|------|------|-------------|
| src/routes/settings/appearance.tsx | Placeholder content "Carregando… (Plan 04)" | Plan 04 |

The appearance route renders a placeholder — this is intentional per plan spec. FOUND-03 (appearance/theme) is Plan 04's scope.

## Threat Flags

No new threat surface beyond what the plan's threat model documents. Specifically:
- T-01-03-01 (raw key disclosure): mitigated — `get_api_key` never called in frontend; only `get_api_key_status`
- T-01-03-02 (key in React state): mitigated — `inputValue` cleared to `''` on save success
- T-01-03-03 (provider ID injection): mitigated — `PROVIDERS` array hardcodes `id` values; never from user input

## Self-Check: PASSED

Files exist:
- src/components/settings/SettingsNav.tsx: FOUND
- src/components/settings/ApiKeysSection.tsx: FOUND
- src/components/settings/ModelsSection.tsx: FOUND
- src/lib/stores/settings.ts: FOUND
- src/routes/settings/api-keys.tsx: FOUND
- src/routes/settings/models.tsx: FOUND
- src/routes/settings/appearance.tsx: FOUND
- src/components/ui/button.tsx: FOUND
- src/components/ui/badge.tsx: FOUND
- src/components/ui/separator.tsx: FOUND
- src/components/ui/select.tsx: FOUND

Commits exist:
- 481c6c8: FOUND (Task 1 — settings sub-nav + API key UI)
- 3ac2864: FOUND (Task 2 — model selection store + ModelsSection)

Test suite: `pnpm vitest run` exits 0, 21/21 tests passing (7 files)
