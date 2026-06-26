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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Export TypeScript bindings in debug mode (dev only)
    #[cfg(debug_assertions)]
    {
        use specta_typescript::Typescript;
        use tauri_specta::Builder;
        Builder::<tauri::Wry>::new()
            .commands(nexusai_settings::collect_commands())
            .export(Typescript::default(), "../src/lib/bindings.ts")
            .expect("Failed to export tauri-specta bindings");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .setup(|app| {
            // WAL must run BEFORE tauri-plugin-sql plugin opens the sqlx pool
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            initialize_database(&app_data_dir)?;
            Ok(())
        })
        // tauri-plugin-sql registered AFTER WAL initialization in setup()
        .plugin(tauri_plugin_sql::Builder::default()
            .add_migrations("sqlite:nexusai.db", vec![]) // migrations run from JS side
            .build()
        )
        .invoke_handler(nexusai_settings::invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
