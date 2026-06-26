---
phase: "01"
plan: "01"
subsystem: scaffold
tags: [tauri-v2, cargo-workspace, sqlite, drizzle-orm, keychain, rust, react, vite]
dependency_graph:
  requires: [01-00]
  provides: [tauri-scaffold, cargo-workspace, drizzle-proxy, wal-init, settings-commands]
  affects: [all-phase-01-plans, all-future-phases]
tech_stack:
  added:
    - tauri v2.11.3
    - react 19.1.0
    - vite 8.1.0
    - typescript 5.8.3
    - tauri-plugin-sql 2.x (sqlite)
    - tauri-plugin-store 2.x
    - tauri-plugin-updater 2.x
    - rusqlite 0.31.0 (bundled)
    - keyring 3.6.3
    - tauri-specta 2.0.0-rc.25
    - specta 2.0.0-rc.25
    - specta-typescript 0.0.12
    - drizzle-orm 0.45.x
    - zustand 5.x
    - "@tanstack/react-query 5.x"
    - "@tanstack/react-router 1.x"
    - lucide-react
  patterns:
    - Inner module pattern for #[tauri::command] + #[specta::specta] to avoid rustc 1.96 symbol collision
    - invoke_handler() + collect_commands() functions exported from settings crate for cross-crate use
    - WAL initialization via rusqlite in setup() hook before tauri-plugin-sql registers
    - import.meta.glob eager:true for Vite-compatible migration loading
key_files:
  created:
    - src-tauri/Cargo.toml (workspace root with 7 members)
    - src-tauri/crates/nexusai-settings/Cargo.toml
    - src-tauri/crates/nexusai-settings/src/lib.rs
    - src-tauri/crates/nexusai-chat/Cargo.toml
    - src-tauri/crates/nexusai-chat/src/lib.rs
    - src-tauri/crates/nexusai-kb/Cargo.toml
    - src-tauri/crates/nexusai-kb/src/lib.rs
    - src-tauri/crates/nexusai-gmail/Cargo.toml
    - src-tauri/crates/nexusai-gmail/src/lib.rs
    - src-tauri/crates/nexusai-calendar/Cargo.toml
    - src-tauri/crates/nexusai-calendar/src/lib.rs
    - src-tauri/crates/nexusai-mcp/Cargo.toml
    - src-tauri/crates/nexusai-mcp/src/lib.rs
    - src-tauri/crates/nexusai-agents/Cargo.toml
    - src-tauri/crates/nexusai-agents/src/lib.rs
    - src-tauri/src/lib.rs
    - src-tauri/src/main.rs
    - src-tauri/capabilities/default.json
    - src-tauri/tauri.conf.json
    - src-tauri/entitlements.plist
    - src/main.tsx
    - src/index.css
    - src/routes/__root.tsx
    - src/lib/db/schema.ts
    - src/lib/db/proxy.ts
    - src/lib/db/migrations/0000_initial.sql
    - package.json (updated with full dep set)
    - index.html
    - vite.config.ts
    - tsconfig.json
    - tsconfig.node.json
  modified: []
decisions:
  - "Inner module isolation for tauri::command + specta::specta — rustc 1.96 generates conflicting use re-exports when both macros applied in same scope; wrapping in mod commands {} resolves it"
  - "invoke_handler() and collect_commands() exposed as public functions from nexusai-settings — cross-crate macro resolution requires generate_handler! and collect_commands! to run inside the crate that defines the commands"
  - "tauri-specta upgraded from rc.21 (plan spec) to rc.25 (latest) — rc.21 had specta dependency conflict; rc.25 resolves it with no API changes"
  - "vite upgraded from 7.x to 8.1.0 — @vitejs/plugin-react@6.0.3 requires vite@^8.0.0; mismatched peer dep caused vitest startup failure"
  - "protocol-asset feature removed from workspace tauri dep — tauri build system validates that Cargo.toml features match tauri.conf.json allowlist; feature not needed for Phase 1"
metrics:
  duration: "28 minutes"
  completed_date: "2026-06-26"
  tasks_completed: 2
  tasks_total: 2
  files_created: 31
  files_modified: 2
---

# Phase 01 Plan 01: Scaffold Summary

Tauri v2 app scaffold with React 19 + Vite 8 frontend, 7-crate Cargo workspace (nexusai-settings active, 6 stubs), SQLite WAL initialization via rusqlite before tauri-plugin-sql, and Drizzle ORM proxy with import.meta.glob migration runner.

## What Was Built

### Task 1: Scaffold Tauri v2 app + Cargo workspace with 7 domain crates

- Tauri v2 app scaffold with React 19, Vite 8, TypeScript frontend
- `src-tauri/Cargo.toml` rewritten as workspace with 7 member crates
- 6 stub crates (chat, kb, gmail, calendar, mcp, agents) — minimal comment-only lib.rs
- `nexusai-settings` active crate with `set_api_key`, `get_api_key_status`, `delete_api_key`
  - Provider allowlist `["openai", "openrouter", "gemini"]` prevents keychain namespace injection
  - `get_api_key_status` returns `ApiKeyStatus { configured: bool }` — never the raw key
  - `invoke_handler()` and `collect_commands()` exposed for cross-crate use
- `src-tauri/src/lib.rs`: WAL initialization in `setup()` before `tauri_plugin_sql` plugin
- `src-tauri/entitlements.plist`: `cs.allow-jit` + `cs.allow-unsigned-executable-memory`
- `src-tauri/tauri.conf.json`: productName="NexusAI", identifier=com.nexusai.app, updater config
- `src-tauri/capabilities/default.json`: sql + store permissions
- `cargo check` exits 0 across all 7 crates

### Task 2: Drizzle ORM proxy + SQLite schema + migration runner

- `src/lib/db/schema.ts`: `schemaMeta` table (schema_meta) with Drizzle types
- `src/lib/db/proxy.ts`: Drizzle sqlite-proxy driver wired to `@tauri-apps/plugin-sql`
  - `db` exported as ready-to-use Drizzle instance
  - `runMigrations()` exported — uses `import.meta.glob` with `eager: true`
  - Migration tracking via `__drizzle_migrations` table
- `src/lib/db/migrations/0000_initial.sql`: creates `schema_meta` table
- FOUND-06 test passes: db-proxy SELECT via mockIPC returns `[]`

## Verification

```
cargo check → 0 errors across 7 crates
pnpm vitest run → 7 test files, 17 tests, all passed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] rustc 1.96 + tauri-macros 2.6 symbol collision with specta**
- **Found during:** Task 1 — first cargo check
- **Issue:** `#[tauri::command]` and `#[specta::specta]` both generate `use` re-exports for their hidden macros (`__cmd__*`, `__tauri_command_name_*`, `__specta__fn__*`). In rustc 1.96, applying both in the same module scope causes "defined multiple times" errors — both define the macro AND import it via `use` in the same namespace.
- **Fix:** Moved command functions into a private inner `mod commands {}` inside `nexusai-settings/src/lib.rs`. Generated `invoke_handler()` and `collect_commands()` functions that call `generate_handler![]` and `collect_commands![]` from within the module scope. The main crate calls these functions instead of using the macros directly.
- **Files modified:** `src-tauri/crates/nexusai-settings/src/lib.rs`, `src-tauri/src/lib.rs`
- **Commits:** 8d3d758

**2. [Rule 3 - Blocking] tauri-specta rc.21 incompatible with current specta versions**
- **Found during:** Task 1 — first cargo check
- **Issue:** Plan specified `tauri-specta = "=2.0.0-rc.21"` but rc.21 requires `specta = "=2.0.0-rc.22"` while the current crates.io only has rc.23+. Dependency conflict prevented resolution.
- **Fix:** Upgraded `tauri-specta` to `=2.0.0-rc.25` (latest published) which works with `specta = "=2.0.0-rc.25"`. API surface is identical — `Builder::new().commands().export()` pattern works the same.
- **Files modified:** `src-tauri/Cargo.toml`, `src-tauri/crates/nexusai-settings/Cargo.toml`
- **Commits:** 8d3d758

**3. [Rule 3 - Blocking] tauri workspace dep had protocol-asset feature not in tauri.conf.json**
- **Found during:** Task 1 — cargo check build script failure
- **Issue:** Plan specified `tauri = { version = "2", features = ["protocol-asset"] }` in workspace deps, but `tauri.conf.json` did not include `protocol-asset` in its feature allowlist. Tauri's build script validates this and exits 1.
- **Fix:** Removed `features = ["protocol-asset"]` from workspace tauri dep (not needed for Phase 1). Feature can be re-added when used in a later phase.
- **Files modified:** `src-tauri/Cargo.toml`
- **Commits:** 8d3d758

**4. [Rule 3 - Blocking] @vitejs/plugin-react@6.0.3 requires vite@^8.0.0 but scaffold installed v7**
- **Found during:** Task 2 verification — vitest startup error
- **Issue:** `@vitejs/plugin-react@6.0.3` peer-requires `vite@^8.0.0`. The Tauri scaffold installed `vite@7.3.5`, causing `ERR_PACKAGE_PATH_NOT_EXPORTED` when vitest loaded the plugin.
- **Fix:** Upgraded vite from `^7.0.4` to `^8.1.0` in `package.json`, ran `pnpm install`.
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Commits:** 8d3d758

## Known Stubs

| File | Stub | Resolved by |
|------|------|-------------|
| src-tauri/crates/nexusai-chat/src/lib.rs | comment-only stub | Phase 2 |
| src-tauri/crates/nexusai-kb/src/lib.rs | comment-only stub | Phase 3 |
| src-tauri/crates/nexusai-gmail/src/lib.rs | comment-only stub | Phase 5 |
| src-tauri/crates/nexusai-calendar/src/lib.rs | comment-only stub | Phase 5 |
| src-tauri/crates/nexusai-mcp/src/lib.rs | comment-only stub | Phase 6 |
| src-tauri/crates/nexusai-agents/src/lib.rs | comment-only stub | Phase 7 |
| src-tauri/src/lib.rs (debug block) | specta export commented as "wired in Phase 2" | Phase 2 |

Note: stub crates are intentional — each phase fills in its domain crate. The specta bindings.ts export in the debug block is wired but will only generate the file at `tauri dev` time (not at `cargo check`).

## Threat Flags

None. No new network endpoints, auth paths beyond those in the plan's threat model, or schema changes at unexpected trust boundaries.

## Self-Check: PASSED

Files exist:
- src-tauri/Cargo.toml: FOUND
- src-tauri/crates/nexusai-settings/src/lib.rs: FOUND
- src-tauri/crates/nexusai-chat/src/lib.rs: FOUND (stub)
- src-tauri/src/lib.rs: FOUND
- src-tauri/entitlements.plist: FOUND
- src-tauri/tauri.conf.json: FOUND
- src/lib/db/proxy.ts: FOUND
- src/lib/db/schema.ts: FOUND
- src/lib/db/migrations/0000_initial.sql: FOUND

Commits exist:
- 8d3d758: FOUND (Task 1)
- a555926: FOUND (Task 2)

Test suite: `pnpm vitest run` exits 0, 17/17 tests passing
Cargo check: 0 errors
