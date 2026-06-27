//! Shared serde + specta IPC types for the Knowledge Base crate.
//! These mirror the TypeScript Drizzle types in src/lib/db/schema.ts (camelCase).
//! Changing these requires regenerating bindings.ts (tauri-specta regenerates on dev).
//!
//! `IndexProgress` mirrors the chat `StreamEvent` tagged-enum shape so the frontend
//! Channel handler pattern is reused for indexing progress.

use serde::{Deserialize, Serialize};

/// Kind of knowledge-base item. Serializes lowercase to match the Drizzle CHECK
/// constraint values (`file` / `note` / `url`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum KbKind {
    File,
    Note,
    Url,
}

/// Lifecycle status of an item's indexing pipeline (D-11). Lowercase to match
/// the Drizzle CHECK constraint values.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum KbStatus {
    Pending,
    Indexing,
    Indexed,
    Failed,
}

/// A knowledge-base item row (mirrors kb_items in schema.ts).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KbItem {
    pub id: String,
    pub kind: KbKind,
    pub title: String,
    pub source_path: Option<String>,
    pub folder_id: Option<String>,
    pub status: KbStatus,
    pub error_reason: Option<String>,
    pub created_at: i64, // Unix milliseconds
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

/// A single indexed chunk row (mirrors kb_chunks in schema.ts).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KbChunk {
    pub id: String,
    pub item_id: String,
    pub ordinal: u32,
    pub content: String,
    pub section: Option<String>,
    pub char_start: Option<i64>,
    pub char_end: Option<i64>,
}

/// A retrieved citation backing a source card in the chat answer (D-04).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Citation {
    pub id: String,
    pub item_id: String,
    pub item_title: String,
    pub kind: KbKind,
    pub section: Option<String>,
    pub snippet: String,
}

/// Indexing progress events streamed over a Tauri Channel during ingestion.
/// Tagged-enum shape identical to the chat StreamEvent so the frontend reuses
/// the same Channel handler pattern (03-RESEARCH §Pattern 4).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(tag = "event", content = "data", rename_all = "lowercase")]
pub enum IndexProgress {
    Started {
        item_id: String,
        total_chunks: Option<u32>,
    },
    Chunk {
        item_id: String,
        done: u32,
        total: Option<u32>,
    },
    Indexed {
        item_id: String,
    },
    Failed {
        item_id: String,
        reason: String,
    },
}

/// Input to the `import_file` command (Plan 03-03).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportFileInput {
    pub item_id: String,
    pub path: String,
    pub title: String,
}

/// Input to the `add_url` command (Plan 03-03).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AddUrlInput {
    pub item_id: String,
    pub url: String,
}

/// Input to the `create_note` command (Plan 03-03).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteInput {
    pub item_id: String,
    pub title: String,
    pub content: String,
    pub folder_id: Option<String>,
}

/// Input to the `query_kb` command (Plan 03-03).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct QueryKbInput {
    pub query: String,
    pub top_k: u32,
}

/// Output of the `query_kb` command (Plan 03-03).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct QueryKbOutput {
    pub chunks: Vec<Citation>,
}

/// Input to the `reindex` command (Plan 03-03).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ReindexInput {
    pub item_id: String,
}
