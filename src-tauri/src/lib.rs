use tauri::Manager;

fn initialize_database(app_data_dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = app_data_dir.join("nexusai.db");
    let conn = rusqlite::Connection::open(&db_path)?;
    conn.execute_batch("
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        PRAGMA cache_size = -64000;
    ")?;
    Ok(())
}

/// Export the tauri-specta TypeScript bindings to `../src/lib/bindings.ts`.
///
/// Single source of truth for the command set exported to the frontend. Called
/// from `run()` in debug builds (dev) and reused by the bindings-export test so
/// the file can be regenerated headlessly (no GUI launch needed).
#[cfg(debug_assertions)]
pub fn export_bindings() {
    use specta_typescript::Typescript;
    use tauri_specta::Builder;
    Builder::<tauri::Wry>::new()
        .commands(nexusai_settings::collect_commands())
        .commands(nexusai_chat::collect_commands())
        .commands(nexusai_kb::collect_commands())
        .export(Typescript::default(), "../src/lib/bindings.ts")
        .expect("Failed to export tauri-specta bindings");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Export TypeScript bindings in debug mode (dev only)
    #[cfg(debug_assertions)]
    export_bindings();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // WAL must run BEFORE tauri-plugin-sql plugin opens the sqlx pool
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            initialize_database(&app_data_dir)?;

            // Register the sqlite-vec auto-extension BEFORE any KB connection is
            // opened (Pattern 1 ordering: auto-extensions only apply to
            // connections opened afterwards). Then bootstrap the KB virtual
            // tables (vec0 + fts5) + triggers — they live outside Drizzle.
            nexusai_kb::vector::register_sqlite_vec();
            let kb_db_path = app_data_dir.join("nexusai.db");
            nexusai_kb::store::kb_connection(&kb_db_path)?;

            Ok(())
        })
        // tauri-plugin-sql registered AFTER WAL initialization in setup()
        .plugin(tauri_plugin_sql::Builder::default()
            .add_migrations("sqlite:nexusai.db", vec![]) // migrations run from JS side
            .build()
        )
        // Single generate_handler! combining all commands from both crates.
        // Tauri v2 does not support calling .invoke_handler() twice (last call wins silently).
        // Both commands modules are pub so their functions are accessible here.
        .invoke_handler(tauri::generate_handler![
            nexusai_settings::commands::set_api_key,
            nexusai_settings::commands::get_api_key_status,
            nexusai_settings::commands::delete_api_key,
            nexusai_settings::commands::stream_llm_demo,
            nexusai_chat::commands::stream_chat,
            nexusai_chat::commands::stop_streaming,
            nexusai_chat::commands::pick_and_encode_file,
            nexusai_chat::commands::encode_file_from_path,
            nexusai_chat::commands::generate_conversation_title,
            nexusai_kb::commands::import_file,
            nexusai_kb::commands::add_url,
            nexusai_kb::commands::create_note,
            nexusai_kb::commands::query_kb,
            nexusai_kb::commands::reindex_item,
            nexusai_kb::commands::delete_item,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
