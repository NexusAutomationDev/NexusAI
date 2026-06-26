//! Serde types for Tauri IPC command inputs and outputs.
//! These mirror the TypeScript types in src/lib/db/schema.ts.
//! Changing these requires updating bindings.ts (tauri-specta regenerates on dev).

use serde::{Deserialize, Serialize};

/// A conversation row from the SQLite conversations table.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ConversationRow {
    pub id: String,
    pub title: String,
    pub created_at: i64, // Unix milliseconds
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
    pub last_model: Option<String>,
}

/// A message row from the SQLite messages table.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MessageRow {
    pub id: String,
    pub conversation_id: String,
    pub role: MessageRole,
    pub content: String,
    pub model: Option<String>,
    pub created_at: i64,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
}

/// File attachment data passed from Tauri dialog → Rust → frontend for preview.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FileAttachment {
    pub filename: String,
    pub mime_type: String,
    pub base64_data: String,
    pub file_size_bytes: u32,
}

/// Input message shape sent from frontend to stream_chat command.
/// Each message in the conversation history.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: MessageRole,
    pub content: String,
    pub attachments: Option<Vec<FileAttachment>>,
}

/// Input to the stream_chat command.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StreamChatInput {
    pub conversation_id: String,
    pub messages: Vec<ChatMessage>, // Full conversation history (D-23)
    pub model: String,              // Model for THIS message (per-message, D-20)
}

/// Input to the generate_conversation_title command (D-06).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GenerateTitleInput {
    pub conversation_id: String,
    pub first_user_message: String,
    pub first_assistant_message: String,
    pub model: String, // Use a fast/cheap model like gpt-4o-mini
}

/// Output from generate_conversation_title.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GenerateTitleOutput {
    pub title: String,
}
