---
phase: "02"
plan: "03"
subsystem: chat-state-layer
tags: [zustand, tanstack-query, streaming, sqlite, drizzle, soft-delete]
dependency_graph:
  requires: ["02-01"]
  provides: ["useChatStore", "chatKeys", "useConversations", "useMessages", "useSearchConversations", "useCreateConversation", "useInsertUserMessage", "useInsertAiMessage", "useDeleteConversation", "useUpdateConversationTitle", "useDeleteMessage"]
  affects: ["02-04", "02-05", "02-06", "02-07"]
tech_stack:
  added: []
  patterns:
    - "Zustand store for transient UI/streaming state (no persistence)"
    - "Channel<StreamEvent> API for streaming token accumulation"
    - "TanStack Query hooks wrapping Drizzle ORM proxy queries"
    - "isNull(deletedAt) soft-delete guard on all queries"
    - "chatKeys query key factory for consistent cache invalidation"
key_files:
  created:
    - src/lib/stores/chat.ts
    - src/lib/queries/chat.ts
    - tests/chat-streaming.test.ts
    - tests/chat-history.test.ts
    - tests/chat-model-switch.test.ts
  modified:
    - src/lib/db/schema.ts
decisions:
  - "Channel<StreamEvent> used directly in store — no event emitter abstraction needed at this layer"
  - "streamingContent accumulates in Zustand (memory) during stream; cleared on done/error"
  - "chatKeys factory uses nested arrays for hierarchical invalidation (conversations > messages)"
  - "useInsertAiMessage takes _conversationModel param to update lastModel on conversation"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-26"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 02 Plan 03: TypeScript State Layer Summary

**One-liner:** Zustand streaming store + TanStack Query CRUD hooks with soft-delete guards for the chat data layer.

## What Was Built

### Task 1: Zustand Chat Store (`src/lib/stores/chat.ts`)

Transient UI state store managing:
- `isStreaming`, `streamingContent`, `streamingConversationId` — stream lifecycle
- `activeConversationId` — which conversation is open
- `currentModel` — defaults to `useSettingsStore.getState().chatModel` (D-22 continuity)
- `pendingAttachments` — files queued for next message (add/remove/clear)
- `startStream()` — invokes `stream_chat` via `Channel<StreamEvent>`, accumulates tokens
- `stopStream()` — invokes `stop_streaming` for the active conversation
- `pickFile()` — invokes `pick_and_encode_file` with cancellation handling

Exported interfaces: `FileAttachment`, `ChatMessage`, `StreamChatInput`.

### Task 2: TanStack Query Hooks (`src/lib/queries/chat.ts`)

Query key factory (`chatKeys`) and 9 hooks:

| Hook | Type | Purpose |
|------|------|---------|
| `useConversations` | Query | All active conversations, newest first |
| `useSearchConversations` | Query | Title + message content search with deduplication |
| `useMessages` | Query | Messages for a conversation, chronological |
| `useCreateConversation` | Mutation | New conversation with 'Nova Conversa' title |
| `useInsertUserMessage` | Mutation | Persist user message immediately (D-32) |
| `useInsertAiMessage` | Mutation | Persist AI message + update lastModel (D-03, D-32) |
| `useDeleteConversation` | Mutation | Soft-delete conversation (D-30) |
| `useUpdateConversationTitle` | Mutation | Update title (D-06 auto-title support) |
| `useDeleteMessage` | Mutation | Soft-delete individual message (D-24) |

All query functions apply `isNull(deletedAt)` guards — deleted rows never reach the UI (T-02-03-01).

### Schema Extension (`src/lib/db/schema.ts`)

Added `conversations`, `messages`, `attachments` tables with TypeScript types as a blocking dependency fix (Rule 3 — Plano 01 executes in another worktree in Wave 1; this worktree needed the types to compile).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added chat schema tables to schema.ts**
- **Found during:** Task 1 setup
- **Issue:** `src/lib/db/schema.ts` lacked `conversations`, `messages`, `attachments` tables needed for TypeScript type imports in both tasks. Plan 01 executes in Wave 1 in a separate worktree and had not been merged.
- **Fix:** Extended `src/lib/db/schema.ts` with the full Phase 2 schema (identical to what Plan 01 specifies), committed as part of Task 1.
- **Files modified:** `src/lib/db/schema.ts`
- **Commit:** `c10d700`

### Pre-existing Failures (out of scope)

- `tests/channel.test.ts:78` — `bindings.streamLlmDemo` is not a direct named export (it lives under `bindings.commands.streamLlmDemo`). Pre-existing failure, not caused by Plan 03 changes.

## Tests Added

| File | Tests | Status |
|------|-------|--------|
| `tests/chat-streaming.test.ts` | 17 | All passing |
| `tests/chat-history.test.ts` | 15 | All passing |
| `tests/chat-model-switch.test.ts` | 8 | All passing |

**Total: 40 new tests, all passing.**

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary crossings introduced. The soft-delete guard (T-02-03-01) and ORM-parameterized LIKE (T-02-03-02) are both present as specified.

## Known Stubs

None — no placeholder data, hardcoded empty values, or mock data flows to UI.

## Self-Check: PASSED

- `src/lib/stores/chat.ts` — FOUND
- `src/lib/queries/chat.ts` — FOUND
- `tests/chat-streaming.test.ts` — FOUND
- `tests/chat-history.test.ts` — FOUND
- `tests/chat-model-switch.test.ts` — FOUND
- Commit `c10d700` — FOUND
- Commit `681e30b` — FOUND
