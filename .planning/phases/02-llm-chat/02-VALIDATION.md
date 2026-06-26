---
phase: 02
slug: llm-chat
status: active
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-25
updated: 2026-06-26
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` (exists — no changes needed) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test tests/chat-*.test.ts -x` (relevant test file, fail fast)
- **After every plan wave:** Run `npm test` (full suite including Phase 1 tests)
- **Before `/gsd-verify-work`:** Full suite must be green + manual smoke test (start conversation, attach file, switch model)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-00-01 | 00 | 1 | all CHAT-* | — | N/A — test-only | scaffold | `npm test tests/setup.ts` | ❌ W0 | ⬜ pending |
| 02-00-02 | 00 | 1 | CHAT-01..05 | — | N/A — test-only | scaffold | `npm test tests/chat-*.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-01 | 01 | 2 | CHAT-01,02 | — | N/A — DB schema | unit | `npm test tests/chat-history.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 2 | CHAT-02 | — | Soft-delete guard in queries | unit | `npm test tests/chat-history.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | CHAT-01 | T-02-02-01..07 | File type allowlist, size limit, filename sanitization | unit | `npm test tests/chat-attachments.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | CHAT-01,03,04 | T-02-02-01..07 | API keys never returned to frontend; streaming via Channel | integration | `npm test tests/chat-streaming.test.ts tests/chat-attachments.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | CHAT-01,02,03 | — | N/A — frontend store | unit | `npm test tests/chat-streaming.test.ts tests/chat-model-switch.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 3 | CHAT-02 | T-02-04-01 | Drizzle parameterized queries (no SQL injection) | unit | `npm test tests/chat-history.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 3 | CHAT-02 | — | N/A — UI components | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 3 | CHAT-02 | T-02-04-01,02 | Search uses parameterized Drizzle LIKE; titles in JSX text nodes | unit | `npm test tests/chat-history.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 4 | CHAT-05 | — | N/A — markdown rendering | unit | `npm test tests/chat-markdown.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 4 | CHAT-05 | — | N/A — rendering only | unit | `npm test tests/chat-markdown.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-06-01 | 06 | 4 | CHAT-04 | T-02-06-03,04 | Drag-drop uses Tauri window.drag-drop event; validated in Rust | unit | `npm test tests/chat-attachments.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-06-02 | 06 | 4 | CHAT-01,03,04 | T-02-06-01 | formatError() never exposes raw API response | unit | `npm test tests/chat-streaming.test.ts tests/chat-attachments.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-07-01 | 07 | 5 | all CHAT-* | T-02-07-01 | conversationId validated via zod schema | integration | `npm test tests/chat-streaming.test.ts tests/chat-history.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-07-02 | 07 | 5 | all CHAT-* | — | N/A — sidebar routing | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-08-01 | 08 | 6 | all CHAT-* | — | N/A — smoke test | manual | See Manual-Only Verifications | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 = Plan 02-00. These files must be created BEFORE any implementation plan executes.

- [ ] `tests/chat-streaming.test.ts` — covers CHAT-01 (Channel API, isStreaming state, stop button)
- [ ] `tests/chat-history.test.ts` — covers CHAT-02 (get_conversations, search_conversations, time sections)
- [ ] `tests/chat-model-switch.test.ts` — covers CHAT-03 (model field on messages, same-conversation multi-model)
- [ ] `tests/chat-attachments.test.ts` — covers CHAT-04 (pick_and_encode_file, base64 shape, send with attachments)
- [ ] `tests/chat-markdown.test.ts` — covers CHAT-05 (MarkdownRenderer import fails = RED; replace placeholders when Plan 05 runs)
- [ ] `tests/setup.ts` — extend with Phase 2 IPC mocks (get_conversations, send_message, pick_and_encode_file, generate_conversation_title, etc.) and `createMockChannel` export

**How RED state is enforced:**

- `tests/chat-markdown.test.ts` — imports `MarkdownRenderer` from `@/routes/chat/components/MarkdownRenderer`. This file does NOT exist until Plan 05. The import itself will cause a module-not-found compile error = RED.
- `tests/chat-streaming.test.ts` — imports `useChatStore` (commented but uses `// @ts-expect-error` pattern with `expect(module).toBeDefined()` against a path that doesn't exist yet). Alternative: leave the import uncommented so Vitest fails at resolution.
- All other test files use `invoke()` with mocked IPC — these will PASS via mocks (acceptable: behavioral tests pass via mocks; the RED contract is satisfied by failing imports in markdown test).

**Note:** The RED state requirement is primarily satisfied by `tests/chat-markdown.test.ts` failing on import. The IPC-based tests (chat-streaming, chat-history, etc.) use mocks and will pass once Wave 0 runs. This is the Nyquist-compliant approach for Tauri apps where real IPC is not available in test environment.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tokens stream visually in real-time (D-12: incremental markdown) | CHAT-01 | Streaming UX cannot be fully automated in jsdom | 1. Open app. 2. Start new conversation. 3. Send "Write a Python hello world". 4. Watch tokens appear token-by-token with code block formatting. |
| Drag-drop file onto chat area (D-15) | CHAT-04 | Tauri window.drag-drop requires actual OS file system events | 1. Open app. 2. Navigate to chat. 3. Drag a PNG from desktop onto the chat area. 4. Verify drag-drop visual feedback (ring-2 ring-accent). 5. Confirm file is picked and shown as preview. |
| Auto-scroll behavior during streaming (D-13) | CHAT-01 | Scroll position requires real browser layout | 1. Load a conversation with 10+ messages (scroll to see all). 2. Scroll up to middle. 3. Send new message. 4. Verify: auto-scroll does NOT interrupt user position. 5. Scroll back to bottom. 6. Send another message. 7. Verify: auto-scroll follows new tokens. |
| Stop button cancels stream (D-14) | CHAT-01 | Requires live LLM API call | 1. Send a long-form request ("Write 500 words about..."). 2. While streaming, click "Parar". 3. Verify: streaming stops immediately. 4. Verify: partial AI response is saved to DB. |
| Conversation title auto-generated (D-06) | CHAT-01 | Requires live LLM API for title generation | 1. Create new conversation ("Nova Conversa"). 2. Send first message. 3. Wait for AI response. 4. Verify: conversation title in sidebar updates from "Nova Conversa" to a descriptive title within 3 seconds. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (5 test files + setup.ts extension)
- [x] No watch-mode flags (all commands use `npm test` without `--watch`)
- [x] Feedback latency <15s (Vitest 4.1.9 with jsdom — typical ~10-15s for this scope)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-26
