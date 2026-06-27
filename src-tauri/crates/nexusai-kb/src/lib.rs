//! nexusai-kb crate — Knowledge Base ingestion, embedding, hybrid retrieval (Phase 3).
//!
//! Tauri commands (Plan 03-03): import_file, add_url, create_note, query_kb,
//! reindex_item, delete_item. Heavy work (parse/embed/persist) runs on a blocking
//! task; per-item progress streams over a `Channel<IndexProgress>` (FOUND-05).
//! Uses the inner-module pattern (mirrors nexusai-chat) for rustc 1.96 + specta
//! compatibility.

pub mod chunk;
pub mod schema;
pub mod vector;
pub mod search;
pub mod ingest;
pub mod embed;
pub mod store;
pub mod progress;

use std::path::PathBuf;

use tauri::Manager;

/// Resolve the shared `nexusai.db` path (same file tauri-plugin-sql uses).
pub(crate) fn db_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("nexusai.db"))
}

/// Resolve the fastembed model cache dir under app-data (persists across launches).
pub(crate) fn model_cache_dir<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("kb-model-cache"))
}

/// Run the chunk→embed→persist pipeline for already-extracted text on a blocking
/// task, streaming progress over `on_event`. Shared by import_file/add_url/create_note.
async fn index_text<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    item_id: String,
    kind: schema::KbKind,
    title: String,
    source_path: Option<String>,
    folder_id: Option<String>,
    text: String,
    on_event: tauri::ipc::Channel<schema::IndexProgress>,
) -> Result<(), String> {
    let db = db_path(&app)?;
    let cache = model_cache_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let mut conn = store::kb_connection(&db).map_err(|e| e.to_string())?;
        store::upsert_item(&conn, &item_id, kind, &title, source_path.as_deref(), folder_id.as_deref())
            .map_err(|e| e.to_string())?;

        let model = embed::global_model(&cache).map_err(|e| e.to_string())?;
        let mut guard = model.lock().map_err(|_| "modelo de embeddings indisponível".to_string())?;

        // index_item records its own terminal failure + emits Failed on error.
        store::index_item(&mut conn, &item_id, &text, &mut guard, &on_event)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// Inner module isolates the #[tauri::command] + #[specta::specta] macros to avoid
// the rustc 1.96 symbol collision when both macros generate `use` re-exports in
// the same scope (mirrors nexusai-chat/src/lib.rs EXACTLY).
pub mod commands {
    use tauri::ipc::Channel;
    use crate::schema::{
        AddUrlInput, CreateNoteInput, ImportFileInput, IndexProgress, KbKind, QueryKbInput,
        QueryKbOutput, ReindexInput,
    };

    /// Import a local file → parse → chunk → embed → store (KB-01).
    #[tauri::command]
    #[specta::specta]
    pub async fn import_file<R: tauri::Runtime>(
        app: tauri::AppHandle<R>,
        input: ImportFileInput,
        on_event: Channel<IndexProgress>,
    ) -> Result<(), String> {
        let text = crate::ingest::parse_file(&input.path).map_err(|e| e.to_string())?;
        crate::index_text(
            app,
            input.item_id,
            KbKind::File,
            input.title,
            Some(input.path),
            None,
            text,
            on_event,
        )
        .await
    }

    /// Fetch a URL → extract main article → chunk → embed → store (KB-04).
    #[tauri::command]
    #[specta::specta]
    pub async fn add_url<R: tauri::Runtime>(
        app: tauri::AppHandle<R>,
        input: AddUrlInput,
        on_event: Channel<IndexProgress>,
    ) -> Result<(), String> {
        let html = crate::ingest::fetch_url(&input.url).await.map_err(|e| e.to_string())?;
        let article = crate::ingest::extract_article(&html).map_err(|e| e.to_string())?;
        let title = if article.title.trim().is_empty() {
            input.url.clone()
        } else {
            article.title
        };
        crate::index_text(
            app,
            input.item_id,
            KbKind::Url,
            title,
            Some(input.url),
            None,
            article.text_content,
            on_event,
        )
        .await
    }

    /// Create a note: write RAW markdown to disk (no normalization, D-08) then
    /// index its content (KB-03 storage; editor UI is Plan 03-05).
    #[tauri::command]
    #[specta::specta]
    pub async fn create_note<R: tauri::Runtime>(
        app: tauri::AppHandle<R>,
        input: CreateNoteInput,
        on_event: Channel<IndexProgress>,
    ) -> Result<(), String> {
        use tauri::Manager;
        let notes_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("kb-notes");
        std::fs::create_dir_all(&notes_dir).map_err(|e| e.to_string())?;
        let note_path = notes_dir.join(format!("{}.md", input.item_id));
        // Write the user's markdown verbatim — D-08 forbids any mutation.
        std::fs::write(&note_path, &input.content).map_err(|e| e.to_string())?;

        crate::index_text(
            app,
            input.item_id,
            KbKind::Note,
            input.title,
            Some(note_path.to_string_lossy().to_string()),
            input.folder_id,
            input.content,
            on_event,
        )
        .await
    }

    /// Hybrid retrieval over the single shared index → citation chunks (KB-02, KB-06).
    /// No agent/owner scoping (D-16).
    #[tauri::command]
    #[specta::specta]
    pub async fn query_kb<R: tauri::Runtime>(
        app: tauri::AppHandle<R>,
        input: QueryKbInput,
    ) -> Result<QueryKbOutput, String> {
        let db = crate::db_path(&app)?;
        let cache = crate::model_cache_dir(&app)?;

        tauri::async_runtime::spawn_blocking(move || -> Result<QueryKbOutput, String> {
            let conn = crate::store::kb_connection(&db).map_err(|e| e.to_string())?;
            let model = crate::embed::global_model(&cache).map_err(|e| e.to_string())?;
            let qvec = {
                let mut guard = model
                    .lock()
                    .map_err(|_| "modelo de embeddings indisponível".to_string())?;
                crate::embed::embed_query(&mut guard, &input.query).map_err(|e| e.to_string())?
            };
            let top_k = (input.top_k as usize).max(1);
            let rowids = crate::search::hybrid_search(&conn, &input.query, &qvec, top_k)
                .map_err(|e| e.to_string())?;
            let chunks = crate::store::query_chunks(&conn, &rowids).map_err(|e| e.to_string())?;
            Ok(QueryKbOutput { chunks })
        })
        .await
        .map_err(|e| e.to_string())?
    }

    /// Idempotently re-index an item (D-12): delete existing chunks/vectors first.
    /// Re-reads the source from kb_items.source_path.
    #[tauri::command]
    #[specta::specta]
    pub async fn reindex_item<R: tauri::Runtime>(
        app: tauri::AppHandle<R>,
        input: ReindexInput,
        on_event: Channel<IndexProgress>,
    ) -> Result<(), String> {
        let db = crate::db_path(&app)?;
        let cache = crate::model_cache_dir(&app)?;

        tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
            let mut conn = crate::store::kb_connection(&db).map_err(|e| e.to_string())?;
            // Re-read source text + kind from the stored item.
            let (kind, source_path): (String, Option<String>) = conn
                .query_row(
                    "SELECT kind, source_path FROM kb_items WHERE id=?1",
                    [&input.item_id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .map_err(|e| e.to_string())?;
            let source_path = source_path.ok_or_else(|| "item sem caminho de origem".to_string())?;
            let text = match kind.as_str() {
                // Notes + files both live on disk; URLs would need re-fetch (kept
                // simple: re-read the persisted .md for notes, parse files).
                "note" => std::fs::read_to_string(&source_path).map_err(|e| e.to_string())?,
                _ => crate::ingest::parse_file(&source_path).map_err(|e| e.to_string())?,
            };

            crate::store::upsert_item(
                &conn,
                &input.item_id,
                match kind.as_str() {
                    "note" => KbKind::Note,
                    "url" => KbKind::Url,
                    _ => KbKind::File,
                },
                &source_path,
                Some(&source_path),
                None,
            )
            .map_err(|e| e.to_string())?;

            let model = crate::embed::global_model(&cache).map_err(|e| e.to_string())?;
            let mut guard = model
                .lock()
                .map_err(|_| "modelo de embeddings indisponível".to_string())?;
            crate::store::reindex_item(&mut conn, &input.item_id, &text, &mut guard, &on_event)
                .map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    }

    /// Soft-delete an item + purge its chunks/vectors (cascade + vector delete).
    #[tauri::command]
    #[specta::specta]
    pub async fn delete_item<R: tauri::Runtime>(
        app: tauri::AppHandle<R>,
        item_id: String,
    ) -> Result<(), String> {
        let db = crate::db_path(&app)?;
        tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
            let mut conn = crate::store::kb_connection(&db).map_err(|e| e.to_string())?;
            crate::store::delete_item(&mut conn, &item_id).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    }

    /// Tauri invoke handler for all KB commands.
    /// Must be called from within this module so generate_handler! resolves the hidden macros.
    pub fn invoke_handler<R: tauri::Runtime>() -> impl Fn(tauri::ipc::Invoke<R>) -> bool {
        tauri::generate_handler![
            import_file,
            add_url,
            create_note,
            query_kb,
            reindex_item,
            delete_item,
        ]
    }

    /// tauri-specta Commands for TypeScript binding export.
    /// Generic-over-R commands need a concrete type (tauri::Wry) for specta inference.
    pub fn collect<R: tauri::Runtime>() -> tauri_specta::Commands<R> {
        tauri_specta::collect_commands![
            import_file::<tauri::Wry>,
            add_url::<tauri::Wry>,
            create_note::<tauri::Wry>,
            query_kb::<tauri::Wry>,
            reindex_item::<tauri::Wry>,
            delete_item::<tauri::Wry>,
        ]
    }
}

/// Returns the Tauri invoke handler for all KB commands.
pub fn invoke_handler<R: tauri::Runtime>() -> impl Fn(tauri::ipc::Invoke<R>) -> bool {
    commands::invoke_handler()
}

/// Returns tauri-specta Commands for TypeScript binding export.
pub fn collect_commands<R: tauri::Runtime>() -> tauri_specta::Commands<R> {
    commands::collect()
}
