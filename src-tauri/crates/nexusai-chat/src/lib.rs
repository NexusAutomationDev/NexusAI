//! nexusai-chat crate — LLM streaming, file attachments, conversation title generation.
//! Tauri commands: stream_chat, stop_streaming, pick_and_encode_file, generate_conversation_title.
//! Uses inner module pattern for rustc 1.96 + specta compatibility.

pub mod schema;
pub mod providers;
pub mod streaming;
pub mod attachments;
pub mod title;

// Inner module isolates the #[tauri::command] + #[specta::specta] macros to avoid
// rustc 1.96 symbol collision when both macros generate `use` re-exports in the same scope.
// Mirrors the pattern in nexusai-settings/src/lib.rs.
pub mod commands {
    use tauri::ipc::Channel;
    use nexusai_settings::StreamEvent;
    use crate::schema::{FileAttachment, GenerateTitleInput, GenerateTitleOutput, StreamChatInput};

    /// Stream LLM response token-by-token via Channel API (CHAT-01, FOUND-05).
    /// Sends full history to support per-message model switching (D-23, CHAT-03).
    #[tauri::command]
    #[specta::specta]
    pub async fn stream_chat(
        input: StreamChatInput,
        on_event: Channel<StreamEvent>,
    ) -> Result<(), String> {
        crate::streaming::stream_chat_impl(input, on_event).await
    }

    /// Cancel an in-progress stream for a conversation (D-14: stop button).
    #[tauri::command]
    #[specta::specta]
    pub async fn stop_streaming(conversation_id: String) -> Result<(), String> {
        crate::streaming::stop_streaming_impl(conversation_id).await
    }

    /// Open OS native file picker, validate, and return file as base64 (CHAT-04, D-15).
    /// Enforces 10MB limit and allowlist of types (D-17).
    /// AppHandle<R> is injected automatically by Tauri — not deserialized from IPC.
    #[tauri::command]
    #[specta::specta]
    pub async fn pick_and_encode_file<R: tauri::Runtime>(
        app: tauri::AppHandle<R>,
    ) -> Result<FileAttachment, String> {
        crate::attachments::pick_and_encode_file_impl(app).await
    }

    /// Auto-generate a 3-8 word conversation title from the first exchange (D-06).
    /// Called by MessageInput.tsx after the first AI response completes.
    #[tauri::command]
    #[specta::specta]
    pub async fn generate_conversation_title(
        input: GenerateTitleInput,
    ) -> Result<GenerateTitleOutput, String> {
        crate::title::generate_conversation_title_impl(input).await
    }

    /// Returns the Tauri invoke handler for all chat commands.
    /// Must be called from within this module so generate_handler! can resolve the hidden macros.
    pub fn invoke_handler<R: tauri::Runtime>() -> impl Fn(tauri::ipc::Invoke<R>) -> bool {
        tauri::generate_handler![
            stream_chat,
            stop_streaming,
            pick_and_encode_file,
            generate_conversation_title,
        ]
    }

    /// Returns a tauri-specta Commands value for TypeScript binding export.
    /// Must be called from within this module so collect_commands! can resolve the hidden macros.
    /// pick_and_encode_file is generic over R — must specify concrete type for specta type inference.
    pub fn collect<R: tauri::Runtime>() -> tauri_specta::Commands<R> {
        tauri_specta::collect_commands![
            stream_chat,
            stop_streaming,
            pick_and_encode_file::<tauri::Wry>,
            generate_conversation_title,
        ]
    }
}

/// Returns the Tauri invoke handler for all chat commands.
pub fn invoke_handler<R: tauri::Runtime>() -> impl Fn(tauri::ipc::Invoke<R>) -> bool {
    commands::invoke_handler()
}

/// Returns tauri-specta Commands for TypeScript binding export.
pub fn collect_commands<R: tauri::Runtime>() -> tauri_specta::Commands<R> {
    commands::collect()
}
