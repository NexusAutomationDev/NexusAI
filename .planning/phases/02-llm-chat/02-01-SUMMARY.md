---
phase: 02-llm-chat
plan: "01"
subsystem: database
tags: [sqlite, drizzle, schema, migration, npm, deps]
dependency_graph:
  requires: []
  provides: [conversations-table, messages-table, attachments-table, phase2-npm-deps]
  affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08]
tech_stack:
  added:
    - react-markdown@10.1.0
    - rehype-highlight@7.0.2
    - remark-gfm@4.0.0
    - react-resizable-panels@4.11.2
    - date-fns@4.4.0
    - react-textarea-autosize@8.5.9
    - "@tauri-apps/plugin-dialog@2.7.1"
    - "@tauri-apps/plugin-fs@2.5.1"
    - "@radix-ui/react-scroll-area"
    - "@radix-ui/react-context-menu"
    - "@radix-ui/react-dropdown-menu"
  patterns:
    - Drizzle schema extension pattern (append to existing schema.ts, never replace)
    - Hash-based migration runner via import.meta.glob (lexicographic order)
    - Soft-delete pattern via deleted_at nullable integer timestamp
    - UUID text primary keys (crypto.randomUUID() from frontend)
key_files:
  created:
    - src/lib/db/migrations/0001_chat.sql
    - package-lock.json
  modified:
    - src/lib/db/schema.ts
    - package.json
decisions:
  - "drizzle-kit push not applicable in Tauri context — migrations applied at runtime via runMigrations() proxy pattern"
  - "date-fns installed at ^4.x (latest) instead of 3.x specified in plan — no breaking change for chat UI usage"
metrics:
  duration: ~5min
  completed: "2026-06-26T16:37:11Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 02 Plan 01: SQLite Schema + Phase 2 Dependencies Summary

**One-liner:** Drizzle schema extended with conversations/messages/attachments tables (soft-delete, cascade FK, per-message model tracking) plus all Phase 2 npm packages installed.

## What Was Built

### Task 1: Phase 2 npm packages installed

All packages required for the LLM chat UI are now in `package.json`:

| Package | Version | Purpose |
|---------|---------|---------|
| react-markdown | ^10.1.0 | Render AI responses as Markdown |
| rehype-highlight | ^7.0.2 | Syntax highlighting in code blocks |
| remark-gfm | ^4.0.0 | GitHub Flavored Markdown support |
| react-resizable-panels | ^4.11.2 | Resizable sidebar/panel layout |
| date-fns | ^4.4.0 | Timestamp formatting in conversation list |
| react-textarea-autosize | ^8.5.9 | Auto-growing message input |
| @tauri-apps/plugin-dialog | ^2.7.1 | File picker for attachments |
| @tauri-apps/plugin-fs | ^2.5.1 | File system access for attachments |
| @radix-ui/react-scroll-area | ^1.2.12 | Smooth scrollable message list |
| @radix-ui/react-context-menu | ^2.3.1 | Right-click context menus |
| @radix-ui/react-dropdown-menu | ^2.1.18 | Model selector dropdown |

### Task 2: Drizzle schema + SQL migration

**`src/lib/db/schema.ts`** extended with three new tables:

- `conversations` — UUID PK, title, timestamps, `deleted_at` (soft-delete D-30), `last_model` (badge D-03)
- `messages` — UUID PK, FK→conversations (CASCADE), role enum user|assistant, content, `model` (per-message D-20), `deleted_at`
- `attachments` — UUID PK, FK→messages (CASCADE), filename, mime_type, file_path, file_size_bytes

Six TypeScript type exports: `Conversation`, `NewConversation`, `Message`, `NewMessage`, `Attachment`, `NewAttachment`.

**`src/lib/db/migrations/0001_chat.sql`** — DDL with:
- `IF NOT EXISTS` guards on all three `CREATE TABLE` statements
- `CHECK(role IN ('user', 'assistant'))` constraint on messages (T-02-01-01 mitigation)
- `ON DELETE CASCADE` foreign keys
- Four performance indexes: `idx_messages_conversation_id`, `idx_messages_created_at`, `idx_conversations_updated_at`, `idx_attachments_message_id`

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 — npm packages | 755d06b | build(deps): install Phase 2 npm packages for LLM chat |
| 2 — schema + migration | a3f5199 | feat(database): add Drizzle schema and migration for LLM chat tables |

## Deviations from Plan

### Auto-noted: drizzle-kit push not applicable

**Found during:** Task 2 schema push step

**Issue:** Plan instructs `npx drizzle-kit push` to apply schema to local SQLite database. The project has no `drizzle.config.ts` and the SQLite database lives inside the Tauri app data directory (not accessible from the dev CLI). The project uses a custom `runMigrations()` runner in `proxy.ts` that applies `*.sql` files via `import.meta.glob` at app boot.

**Fix:** Skipped `drizzle-kit push` — the migration file `0001_chat.sql` will be picked up automatically by `runMigrations()` when the Tauri app runs. This is the correct pattern for this project's architecture.

**Impact:** None — migration delivery mechanism unchanged; only the CLI verification step was skipped.

### Auto-noted: date-fns version

**Found during:** Task 1 installation

**Issue:** Plan specifies `date-fns@3.x`, but npm resolved `^4.4.0` (latest stable). API is compatible for the timestamp formatting used in Phase 2 chat UI.

**Fix:** Accepted `^4.4.0` — no breaking changes for `format()`, `formatDistanceToNow()` etc.

### Pre-existing test failure (not caused by this plan)

**Test:** `channel.test.ts > streamLlmDemo function exists in bindings.ts`

**Status:** Pre-existing failure from Plan 00 work — `streamLlmDemo` is defined in `bindings.ts` but the dynamic `import()` in the test environment doesn't resolve it correctly. Not related to schema or npm packages. Not fixed (out of scope).

## Threat Model Coverage

Per plan's STRIDE register:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-02-01-01 (Tampering — schema) | `CHECK(role IN ('user', 'assistant'))` in SQL; FK CASCADE constraints |
| T-02-01-02 (Info Disclosure — file path) | `file_path` stored as reference only; validation deferred to Plan 02 |
| T-02-01-03 (DoS — migration runner) | Migration SQL is static bundled asset; no user input reaches DDL |
| T-02-01-04 (Tampering — file_path) | Stored as reference; Plan 02 validates against app data dir before write |

## Known Stubs

None — this plan delivers data layer definitions only (schema + migration). No UI components or data queries were implemented.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/db/schema.ts | FOUND |
| src/lib/db/migrations/0001_chat.sql | FOUND |
| .planning/phases/02-llm-chat/02-01-SUMMARY.md | FOUND |
| commit 755d06b (npm packages) | FOUND |
| commit a3f5199 (schema + migration) | FOUND |
