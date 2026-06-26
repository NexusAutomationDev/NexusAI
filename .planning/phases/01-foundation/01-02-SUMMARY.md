---
phase: "01"
plan: "02"
subsystem: ui
tags: [react, tanstack-router, tailwind, shadcn-ui, sidebar, layout, dark-mode, tooltip]

requires:
  - phase: "01-01"
    provides: [tauri-scaffold, drizzle-proxy, runMigrations]
provides:
  - app-shell-layout
  - icon-only-sidebar
  - tanstack-router-routes
  - module-stub-pages
  - settings-route-skeleton
  - dark-mode-default
  - css-variable-theme-tokens
affects:
  - 01-03
  - 01-04
  - all-future-plans

tech-stack:
  added:
    - "@tanstack/router-plugin@1.168.18 (Vite plugin for file-based routing)"
    - "@radix-ui/react-tooltip@1.2.10 (shadcn/ui Tooltip primitive)"
    - "clsx@2.x + tailwind-merge@3.6.0 (cn() utility)"
    - "class-variance-authority (shadcn/ui peer)"
    - "@types/node@26.x (path alias in vite.config.ts)"
  patterns:
    - "TanStack Router file-based routing — routes mirror src/routes/ directory structure"
    - "path alias @/ → ./src/ configured in tsconfig, vite.config.ts, and vitest.config.ts"
    - "Dark mode via .dark class on <html> applied before React hydration"
    - "Accent color via data-accent attribute on <html> with CSS @layer overrides"
    - "Sidebar module disabled state: aria-disabled + onClick preventDefault + opacity-40"

key-files:
  created:
    - src/components/layout/Sidebar.tsx
    - src/components/layout/AppShell.tsx
    - src/components/layout/ModuleStub.tsx
    - src/components/ui/tooltip.tsx
    - src/lib/utils.ts
    - src/routes/index.tsx
    - src/routes/chat/index.tsx
    - src/routes/kb/index.tsx
    - src/routes/gmail/index.tsx
    - src/routes/calendar/index.tsx
    - src/routes/mcp/index.tsx
    - src/routes/agents/index.tsx
    - src/routes/settings/index.tsx
  modified:
    - src/routes/__root.tsx
    - src/main.tsx
    - src/index.css
    - vite.config.ts
    - vitest.config.ts
    - tsconfig.json
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Module icons are disabled via aria-disabled + preventDefault rather than navigation guard — purely frontend stubs, no IPC, acceptable for Phase 1 (T-01-02-02)"
  - "Tooltip content uses hardcoded pt-BR strings only — no user data interpolation (T-01-02-01 XSS mitigation)"
  - "vitest.config.ts gets its own alias config (resolve.alias) separate from vite.config.ts — vitest does not automatically inherit vite config aliases"
  - "TDD test count drops from 17 to 16: replaced 4 placeholder tests with 3 real render assertions for ModuleStub"

patterns-established:
  - "Path alias pattern: @/ prefix for all src/ imports across vite.config.ts and vitest.config.ts"
  - "Layout shell pattern: __root.tsx exports AppShell which renders Sidebar + <Outlet>"
  - "Stub route pattern: createFileRoute('/module/') returns ModuleStub with moduleName prop"

requirements-completed: [FOUND-03, FOUND-04]

duration: 18min
completed: 2026-06-26
---

# Phase 01 Plan 02: App Shell Layout Summary

Icon-only 48px sidebar with 7 module icons (6 opacity-40 stubs + Settings gear), TanStack Router file-based routes for all modules, dark mode applied before hydration, and CSS variable theme tokens for 5 accent colors.

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-26T00:22:00Z
- **Completed:** 2026-06-26T00:40:05Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 21

## Accomplishments

- App shell renders with 48px icon-only sidebar on the left (D-01) — `w-12` fixed column
- All 7 module icons present: Chat, KB, Gmail, Calendar, MCPs, Agents (opacity-40 + "Em breve" tooltip per D-03) + Settings gear pinned to bottom (D-04)
- Dark mode class added to `<html>` before React hydration (D-02); `data-accent="violet"` default set
- Full CSS variable system for 5 accent colors (violet/blue/green/orange/red) and dark/light theme tokens
- TanStack Router wired with generated routeTree — 7 routes + index redirect to /settings
- `runMigrations()` called in `main()` before ReactDOM.render (FOUND-06 integrity maintained)

## Task Commits

1. **TDD RED — failing test** - `cd1d2e1` (test)
2. **TDD GREEN — production code** - `b33ba5d` (feat)

## Files Created/Modified

- `src/components/layout/Sidebar.tsx` — 48px icon-only sidebar, 6 disabled stubs + Settings gear
- `src/components/layout/AppShell.tsx` — root layout: Sidebar + `<Outlet>` with `ml-12` offset
- `src/components/layout/ModuleStub.tsx` — reusable "Em breve" stub for non-implemented modules
- `src/components/ui/tooltip.tsx` — shadcn/ui Tooltip component (Radix UI based)
- `src/lib/utils.ts` — `cn()` helper using clsx + tailwind-merge
- `src/routes/__root.tsx` — updated to use AppShell
- `src/routes/index.tsx` — redirects `/` → `/settings`
- `src/routes/{chat,kb,gmail,calendar,mcp,agents}/index.tsx` — 6 module stub routes
- `src/routes/settings/index.tsx` — Settings layout shell with 160px sub-nav placeholder
- `src/main.tsx` — rewritten: TanStack Router + dark mode init + runMigrations
- `src/index.css` — full shadcn/ui CSS variable system with dark theme + 5 accent overrides
- `vite.config.ts` — added TanStackRouterVite plugin + `@/` path alias
- `vitest.config.ts` — added `@/` path alias (resolve.alias) for test environment
- `tsconfig.json` — added baseUrl + paths for `@/` alias
- `package.json` / `pnpm-lock.yaml` — added @tanstack/router-plugin, @radix-ui/react-tooltip, clsx, tailwind-merge, class-variance-authority, @types/node

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest did not inherit vite.config.ts path alias**
- **Found during:** Task 1 verification (RED run)
- **Issue:** `@/components/ui/tooltip` import in ModuleStub.tsx resolved correctly in vite but failed in vitest with "Failed to resolve import" — vitest uses its own config and does not inherit vite alias config
- **Fix:** Added `resolve.alias: { '@': path.resolve(__dirname, './src') }` to `vitest.config.ts`
- **Files modified:** vitest.config.ts
- **Commit:** b33ba5d

## Known Stubs

| File | Stub | Resolved by |
|------|------|-------------|
| src/routes/settings/index.tsx | Sub-nav placeholder "Carregando…" | Plan 03 (Settings sub-nav) |
| src/components/layout/Sidebar.tsx | All 6 modules have `implemented: false` | Plans 02-07 (each module fills in) |
| src/main.tsx | imports routeTree.gen which is generated at `vite dev` time | Generated automatically by TanStackRouterVite plugin on first `pnpm dev` |

Note: `routeTree.gen.ts` is generated by the TanStack Router Vite plugin at build/dev time. It does not exist as a committed file — the plugin creates it. This is the intended behavior for file-based routing.

## Threat Flags

None. All tooltip content is hardcoded pt-BR strings (T-01-02-01 mitigated). Stub icons use frontend-only aria-disabled — no IPC calls (T-01-02-02 accepted). CSS variables expose theme tokens only (T-01-02-03 accepted).

## Self-Check: PASSED

Files exist:
- src/components/layout/Sidebar.tsx: FOUND
- src/components/layout/AppShell.tsx: FOUND
- src/components/layout/ModuleStub.tsx: FOUND
- src/components/ui/tooltip.tsx: FOUND
- src/lib/utils.ts: FOUND
- src/routes/chat/index.tsx: FOUND
- src/routes/kb/index.tsx: FOUND
- src/routes/gmail/index.tsx: FOUND
- src/routes/calendar/index.tsx: FOUND
- src/routes/mcp/index.tsx: FOUND
- src/routes/agents/index.tsx: FOUND
- src/routes/settings/index.tsx: FOUND

Commits exist:
- cd1d2e1: FOUND (TDD RED)
- b33ba5d: FOUND (TDD GREEN)

Test suite: `pnpm vitest run` exits 0, 16/16 tests passing (routes: 3/3)
