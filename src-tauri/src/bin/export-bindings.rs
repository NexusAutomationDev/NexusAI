//! Headless tauri-specta bindings exporter.
//!
//! Regenerates `../src/lib/bindings.ts` without launching the Tauri GUI (no
//! WebView2 runtime needed). Run from `src-tauri/`:
//!   `cargo run --bin export-bindings`
//!
//! Mirrors the export `nexusai_lib::run()` performs at dev startup; kept as a
//! separate bin so bindings can be regenerated in CI / parallel executors.

fn main() {
    #[cfg(debug_assertions)]
    {
        nexusai_lib::export_bindings();
        println!("bindings.ts regenerated");
    }
    #[cfg(not(debug_assertions))]
    {
        eprintln!("export-bindings is a debug-only tool");
    }
}
