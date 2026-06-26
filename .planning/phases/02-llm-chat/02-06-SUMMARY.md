---
phase: "02-llm-chat"
plan: "06"
subsystem: "chat-ui"
tags: [chat, ui, attachments, drag-drop, streaming, model-picker]
dependency_graph:
  requires:
    - "02-02"  # nexusai-chat Rust crate (stream_chat, pick_and_encode_file)
    - "02-04"  # chat layout shell
    - "02-05"  # message display layer
  provides:
    - "MessageInput component with full send/stop/model-picker/attachment flow"
    - "FileAttachmentPreview component with image thumbnail and remove button"
    - "encode_file_from_path Rust command for drag-drop path encoding"
  affects:
    - "02-07"  # chat view assembly — imports MessageInput
tech_stack:
  added:
    - "react-textarea-autosize (TextareaAutosize for auto-growing textarea)"
    - "Tauri onDragDropEvent API (drag-drop file handling)"
    - "encode_file_from_path Rust command (drag-drop path encoding)"
  patterns:
    - "Zustand store actions consumed directly in component (startStream, stopStream, pickFile)"
    - "TanStack Query mutations for user/AI message persistence"
    - "formatError() normalizes raw API errors to pt-BR user-facing messages (T-02-06-01)"
    - "Tauri Channel API for streaming accumulation"
key_files:
  created:
    - src/routes/chat/components/FileAttachmentPreview.tsx
    - src/routes/chat/components/MessageInput.tsx
  modified:
    - src-tauri/crates/nexusai-chat/src/attachments.rs
    - src-tauri/crates/nexusai-chat/src/lib.rs
    - src-tauri/src/lib.rs
decisions:
  - "useInsertAiMessage requires _conversationModel field — MessageInput passes currentModel to update conversation.lastModel (D-03, D-22)"
  - "encode_file_from_path added to Rust crate to handle Tauri drag-drop paths (DataTransfer API is empty in webviews)"
  - "formatError() intercepts raw Rust/LLM errors before DOM insertion (T-02-06-01 mitigation)"
metrics:
  duration: "~20min"
  completed: "2026-06-26"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 3
---

# Phase 02 Plan 06: Message Input Area Summary

**One-liner:** Full message input with TextareaAutosize, Tauri drag-drop via onDragDropEvent + encode_file_from_path, model picker, send/stop flow, and pt-BR error formatting.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | FileAttachmentPreview component | dc8fb43 | src/routes/chat/components/FileAttachmentPreview.tsx |
| 2 | MessageInput — textarea, model picker, send/stop, paperclip + drag-drop | 5ae8999 | src/routes/chat/components/MessageInput.tsx, src-tauri/crates/nexusai-chat/src/attachments.rs, src-tauri/crates/nexusai-chat/src/lib.rs, src-tauri/src/lib.rs |

## What Was Built

### FileAttachmentPreview (`FileAttachmentPreview.tsx`)

- Renders image thumbnails (`<img src={data:...base64...}>`) for `image/*` MIME types
- Renders `<FileText />` icon for non-image types (PDF, TXT, MD, DOCX)
- Remove button per file with `aria-label="Remover [filename]"` (D-16)
- Multiple files in `flex-wrap gap-2` row (D-19)
- `formatFileSize` helper: B / KB / MB display
- Returns `null` when attachments array is empty (no layout shift)

### MessageInput (`MessageInput.tsx`)

- **Auto-growing textarea**: `react-textarea-autosize` with `minRows={1}`, `maxRows={8}`, `maxHeight: 200px` (D-27)
- **Enter sends, Shift+Enter newlines**: `handleKeyDown` checks `e.key === "Enter" && !e.shiftKey` (D-27)
- **Paperclip button**: calls `pickFile()` from chat store → `invoke('pick_and_encode_file')` (D-15)
- **Drag-drop**: `getCurrentWebviewWindow().onDragDropEvent` → `invoke('encode_file_from_path', { path })` for each dropped file (D-15 — fully implemented, not stubbed)
- **Visual drag indicator**: `ring-2 ring-accent ring-inset` on container when files drag over (D-15)
- **Model picker**: `<Select>` with `AVAILABLE_MODELS` from settings store (D-20, D-22)
- **Default model**: syncs from `useSettingsStore.chatModel` on mount (D-22)
- **Send button**: `"Enviar"` with `bg-accent` at rest; disabled if empty input and no attachments
- **Stop button**: `"Parar"` with `bg-accent` during streaming, calls `stopStream()` (D-14)
- **Inline errors**: `formatError()` converts raw errors to pt-BR messages (D-25, T-02-06-01)
- **Title auto-generation**: `generate_conversation_title` invoked after first AI response, with fallback to truncated message text (D-06)
- **AI message persistence**: passes `_conversationModel` to `useInsertAiMessage` to update `conversation.lastModel` (D-03, D-22)

### Rust: `encode_file_from_path` command

Added to `nexusai-chat` crate (both `attachments.rs` impl and `lib.rs` command registration, plus `src-tauri/src/lib.rs` handler):

- Takes OS file path from Tauri drag-drop event payload
- Applies identical validation to `pick_and_encode_file`: type allowlist, 10MB cap, filename sanitization (T-02-06-03)
- Registered in `generate_handler![]`, `collect_commands![]`, and specta type export

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `useInsertAiMessage` signature mismatch**
- **Found during:** Task 2
- **Issue:** The plan's `MessageInput.tsx` template called `insertAiMessage(aiMsg)` with a plain `NewMessage`, but `useInsertAiMessage` in `queries/chat.ts` requires `NewMessage & { _conversationModel: string }` to update `conversation.lastModel`
- **Fix:** Added `_conversationModel: currentModel` field to the AI message object before calling `insertAiMessage`
- **Files modified:** src/routes/chat/components/MessageInput.tsx
- **Commit:** 5ae8999

## Known Stubs

None — all functionality is wired to real data sources:
- Drag-drop uses real `onDragDropEvent` + `encode_file_from_path` (not a stub)
- Model picker uses real `AVAILABLE_MODELS` from settings store
- Error messages use real `formatError()` normalization
- Title generation calls real `generate_conversation_title` Rust command

## Threat Flags

None — all threat model mitigations from `<threat_model>` were implemented:
- T-02-06-01: `formatError()` normalizes errors before DOM insertion
- T-02-06-03: `encode_file_from_path` applies full Rust-side validation on drag-drop paths

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/routes/chat/components/FileAttachmentPreview.tsx` exists | FOUND |
| `src/routes/chat/components/MessageInput.tsx` exists | FOUND |
| Commit `dc8fb43` (FileAttachmentPreview) exists | FOUND |
| Commit `5ae8999` (MessageInput + Rust encode_file_from_path) exists | FOUND |
