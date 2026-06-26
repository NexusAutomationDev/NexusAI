---
phase: "02"
plan: "00"
subsystem: testing
tags: [tdd, test-scaffolds, chat, red-state, vitest]
dependency_graph:
  requires: []
  provides:
    - tests/chat-streaming.test.ts
    - tests/chat-history.test.ts
    - tests/chat-model-switch.test.ts
    - tests/chat-attachments.test.ts
    - tests/chat-markdown.test.ts
    - tests/setup.ts (Phase 2 mocks)
  affects:
    - plans 02-01 through 02-08 (all subsequent plans must pass these tests)
tech_stack:
  added: []
  patterns:
    - RED-first TDD: test files that fail at import level enforce genuine RED state
    - Drizzle hook mocking: vi.mock('@/lib/db') intercepts query layer without IPC
    - mockIPC extension: Phase 2 real IPC commands added alongside preserved Phase 1 mocks
key_files:
  created:
    - tests/chat-streaming.test.ts
    - tests/chat-history.test.ts
    - tests/chat-model-switch.test.ts
    - tests/chat-attachments.test.ts
    - tests/chat-markdown.test.ts
  modified:
    - tests/setup.ts
decisions:
  - "Tests target Drizzle hook abstraction layer (useConversations, useChatStore) not phantom IPC commands"
  - "RED state enforced via import-level failures (module not found) for files depending on Plan 03 and 05"
  - "chat-attachments GREEN is acceptable because pick_and_encode_file is a real Tauri IPC command in Rust crate"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-26"
  tasks_completed: 2
  files_modified: 6
---

# Phase 2 Plan 00: TDD Test Scaffolds Summary

TDD RED scaffolds for all five CHAT requirements: five test files targeting Drizzle hooks and Zustand store (not phantom IPC commands), with four in genuine RED state (import-level failures) and one in GREEN (real IPC command mock).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend setup.ts with Phase 2 IPC mocks | c2652f3 | tests/setup.ts |
| 2 | Create five RED test scaffolds (CHAT-01 to CHAT-05) | 08274ee | tests/chat-streaming.test.ts, tests/chat-history.test.ts, tests/chat-model-switch.test.ts, tests/chat-attachments.test.ts, tests/chat-markdown.test.ts |

## What Was Built

**tests/setup.ts (extended):**
- Added Phase 2 real IPC mocks: `pick_and_encode_file`, `encode_file_from_path`, `generate_conversation_title`, `stop_streaming`
- Exported `createMockChannel` factory for per-test streaming use
- Preserved all Phase 1 mocks unchanged
- Added comments clarifying which operations are Drizzle-backed (not IPC)

**Five test scaffolds:**

| File | Requirement | RED state trigger | Status |
|------|-------------|-------------------|--------|
| chat-streaming.test.ts | CHAT-01 | import `useChatStore` from `@/lib/stores/chat` (missing until Plan 03) | RED |
| chat-history.test.ts | CHAT-02 | import `useConversations` from `@/lib/queries/chat` (missing until Plan 03) | RED |
| chat-model-switch.test.ts | CHAT-03 | import `useChatStore` + `useInsertAiMessage` (missing until Plan 03) | RED |
| chat-attachments.test.ts | CHAT-04 | uses real `pick_and_encode_file` IPC mock | GREEN |
| chat-markdown.test.ts | CHAT-05 | import `MarkdownRenderer` from `@/routes/chat/components/MarkdownRenderer` (missing until Plan 05) | RED |

## Verification Results

- `ls tests/chat-*.test.ts | wc -l` → 5
- `npm test tests/chat-streaming.test.ts` → FAIL: "Failed to resolve import @/lib/stores/chat" (RED confirmed)
- `npm test tests/chat-markdown.test.ts` → FAIL: "Transform failed" / module not found (RED confirmed)
- `npm test tests/chat-history.test.ts` → FAIL: "Failed to resolve import @/lib/queries/chat" (RED confirmed)
- `npm test tests/chat-model-switch.test.ts` → FAIL: "Failed to resolve import @/lib/stores/chat" (RED confirmed)
- `npm test tests/chat-attachments.test.ts` → PASS: 4/4 tests (GREEN as expected)
- No `invoke('get_conversations')` or `invoke('send_message')` phantom calls in any test file
- No `expect(true).toBe(true)` trivial assertions in any test file

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan creates test infrastructure only; no production code was introduced.

## Threat Flags

None. Test-only files; no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- tests/chat-streaming.test.ts: FOUND
- tests/chat-history.test.ts: FOUND
- tests/chat-model-switch.test.ts: FOUND
- tests/chat-attachments.test.ts: FOUND
- tests/chat-markdown.test.ts: FOUND
- commit c2652f3: FOUND (setup.ts Phase 2 mocks)
- commit 08274ee: FOUND (five RED test scaffolds)
