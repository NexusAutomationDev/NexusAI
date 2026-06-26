---
phase: "02"
plan: "02"
subsystem: chat-rust-backend
tags: [rust, tauri, llm, streaming, async-openai, channel-api, file-picker]
dependency_graph:
  requires: ["02-01"]
  provides: ["nexusai-chat crate", "stream_chat command", "stop_streaming command", "pick_and_encode_file command", "generate_conversation_title command"]
  affects: ["02-03", "02-04", "02-05", "02-06", "02-07", "02-08", "02-09"]
tech_stack:
  added: ["async-openai 0.27", "reqwest 0.12", "base64 0.22", "keyring 3", "lazy_static 1", "futures 0.3", "tauri-plugin-dialog 2"]
  patterns: ["Channel<StreamEvent> streaming", "OS Keychain API key storage", "inner pub mod commands pattern", "combined generate_handler! for multi-crate Tauri apps"]
key_files:
  created:
    - src-tauri/crates/nexusai-chat/Cargo.toml
    - src-tauri/crates/nexusai-chat/src/schema.rs
    - src-tauri/crates/nexusai-chat/src/providers.rs
    - src-tauri/crates/nexusai-chat/src/streaming.rs
    - src-tauri/crates/nexusai-chat/src/attachments.rs
    - src-tauri/crates/nexusai-chat/src/title.rs
    - src-tauri/crates/nexusai-chat/src/lib.rs
  modified:
    - src-tauri/crates/nexusai-settings/src/lib.rs
    - src-tauri/src/lib.rs
    - src-tauri/Cargo.toml
decisions:
  - "Combined single generate_handler![] in workspace root instead of chaining two invoke_handler() calls — Tauri v2 silently drops all but the last .invoke_handler() call"
  - "pick_and_encode_file declared as generic fn<R: Runtime> with AppHandle<R> injection — tauri-specta requires concrete type at collect_commands! call site (Wry)"
  - "nexusai-settings::mod commands promoted to pub mod to enable cross-crate generate_handler! — minimal safe change"
  - "tauri-plugin-dialog registered in src-tauri/src/lib.rs setup to enable file picker functionality"
metrics:
  duration_minutes: 35
  completed_date: "2026-06-26"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 3
---

# Phase 02 Plan 02: nexusai-chat Rust Crate Summary

One-liner: Rust `nexusai-chat` crate with async-openai streaming via Channel API, OS Keychain key retrieval, base64 file attachments with 10MB/allowlist guard, and LLM-powered title generation.

## What Was Built

The `nexusai-chat` crate implements all LLM backend logic required for the chat module. All API calls happen exclusively in Rust — never in the JS webview — to bypass CORS restrictions and keep API keys secure in the OS Keychain.

### Five modules created:

**schema.rs** — Serde structs mirroring the TypeScript DB schema: `ConversationRow`, `MessageRow`, `MessageRole`, `FileAttachment`, `ChatMessage`, `StreamChatInput`, `GenerateTitleInput`, `GenerateTitleOutput`. All derive `specta::Type` for automatic TypeScript binding generation.

**providers.rs** — LLM client factory supporting OpenAI (direct), OpenRouter (OpenAI-compatible), and Gemini (via Google's OpenAI-compatible endpoint). `build_client()` reads API keys from OS Keychain via `keyring`; `build_api_messages()` converts `Vec<ChatMessage>` to async-openai types, including multimodal image-part construction for attachments.

**streaming.rs** — `stream_chat_impl()` uses `Channel<StreamEvent>` (FOUND-05 pattern, never `emit()` in a loop). Full conversation history sent on each call (D-23) to support per-message model switching. Cancellation via `tokio::sync::watch` channel stored in a `lazy_static` `HashMap<conversation_id, Sender>`.

**attachments.rs** — `pick_and_encode_file_impl<R: Runtime>()` opens OS-native file picker via `tauri-plugin-dialog`, validates file extension against an allowlist (T-02-02-01), enforces 10MB size limit (T-02-02-02), encodes as base64, and sanitizes the filename (strips `/`, `\`, `.`).

**title.rs** — `generate_conversation_title_impl()` calls LLM with a compact prompt requesting a 3-8 word title (`max_tokens(20)`). Falls back to truncating the first user message if the API call fails.

### Registration:

- `nexusai-chat/src/lib.rs`: `pub mod commands` with `#[tauri::command] #[specta::specta]` on all four commands; `invoke_handler()` and `collect_commands()` follow the same delegation pattern as `nexusai-settings`.
- `src-tauri/src/lib.rs`: Single `tauri::generate_handler![]` macro lists all commands from both crates (settings + chat). `tauri-plugin-dialog` registered in plugin chain.
- `src-tauri/src/lib.rs`: `nexusai_chat::collect_commands()` chained in tauri-specta `Builder` for TypeScript binding export.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] async-openai 0.27 struct API differs from plan's code examples**
- **Found during:** Task 2
- **Issue:** Plan used builder pattern types (`ChatCompletionRequestMessageArgs::default()`, `ImageUrlArgs`, field `r#type`) that don't exist in async-openai 0.27. Actual API uses direct struct construction.
- **Fix:** Rewrote `providers.rs` using actual struct types: `ChatCompletionRequestUserMessage { content, name }`, `ChatCompletionRequestAssistantMessage { content, name, tool_calls, refusal, audio, function_call }`, `ChatCompletionRequestMessageContentPartText { text }`, `ChatCompletionRequestMessageContentPartImage { image_url }`.
- **Files modified:** `src-tauri/crates/nexusai-chat/src/providers.rs`
- **Commit:** 0bfad47 (initial), 2248e85 (final working)

**2. [Rule 1 - Bug] FilePath::to_string_lossy() does not exist**
- **Found during:** Task 2
- **Issue:** `tauri-plugin-dialog` returns `FilePath` (from `tauri-plugin-fs`) which has no `to_string_lossy()` method. Correct method is `into_path()` returning `Result<PathBuf>`.
- **Fix:** Changed `attachments.rs` to call `file_path.into_path().map_err(...)` and work with the resulting `PathBuf`.
- **Files modified:** `src-tauri/crates/nexusai-chat/src/attachments.rs`

**3. [Rule 1 - Bug] Invoke<R> does not implement Clone — cannot chain two invoke_handler() closures**
- **Found during:** Task 3
- **Issue:** Plan suggested merging two `invoke_handler()` closures via `handler1(invoke.clone()) || handler2(invoke)`. `tauri::Invoke` is not `Clone`.
- **Fix:** Promoted `nexusai-settings::mod commands` to `pub mod commands`, then used a single `tauri::generate_handler![]` in `src-tauri/src/lib.rs` listing all commands from both crates explicitly.
- **Files modified:** `src-tauri/crates/nexusai-settings/src/lib.rs`, `src-tauri/src/lib.rs`

**4. [Rule 1 - Bug] tauri-specta cannot infer R for generic pick_and_encode_file command**
- **Found during:** Task 3
- **Issue:** `tauri_specta::collect_commands!` could not infer the concrete Runtime type for `pick_and_encode_file<R: Runtime>`. Error: "cannot infer type, must implement tauri::Runtime".
- **Fix:** Specified concrete type at collect site: `pick_and_encode_file::<tauri::Wry>` in the `collect_commands!` macro, per the tauri-specta documentation pattern for generic commands.
- **Files modified:** `src-tauri/crates/nexusai-chat/src/lib.rs`

**5. [Rule 1 - Bug] AppHandle without Runtime generic not valid as CommandArg**
- **Found during:** Task 3
- **Issue:** `tauri::AppHandle` (without `<R>`) does not implement `CommandArg` and cannot be deserialized as a Tauri command parameter. Must be `AppHandle<R: Runtime>`.
- **Fix:** Changed `pick_and_encode_file` and `pick_and_encode_file_impl` to be generic over `R: Runtime`, accepting `AppHandle<R>`.
- **Files modified:** `src-tauri/crates/nexusai-chat/src/lib.rs`, `src-tauri/crates/nexusai-chat/src/attachments.rs`

## Known Stubs

None — all implementation is complete and functional. API key retrieval, streaming, file encoding, and title generation all have real implementations (not mocks). Runtime behavior requires actual OS Keychain entries and network access.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model. All mitigations (T-02-02-01 through T-02-02-08) are implemented as specified.

## Self-Check: PASSED

- All 7 created files found on disk
- All 3 task commits verified in git log (7f835e3, 0bfad47, 2248e85)
- `cargo check` exits 0: `Finished 'dev' profile [unoptimized + debuginfo]`
