//! Indexing-progress emission helper over a Tauri Channel.
//!
//! Mirrors nexusai-chat/src/streaming.rs's `on_event.send(...).ok()` pattern
//! (FOUND-05: never `emit()` in a loop — always a Channel). The frontend reuses
//! the same Channel handler shape it uses for chat streaming because
//! `IndexProgress` mirrors `StreamEvent`'s tagged-enum shape.

use crate::schema::IndexProgress;
use tauri::ipc::Channel;

/// Send one indexing-progress event over the Channel.
///
/// Errors are swallowed (`.ok()`) exactly like the chat streaming helper — a
/// dropped progress event must never abort the indexing pipeline; the durable
/// `kb_items.status` column is the source of truth for reconcile-on-reload (D-11).
pub fn emit(ch: &Channel<IndexProgress>, ev: IndexProgress) {
    ch.send(ev).ok();
}
