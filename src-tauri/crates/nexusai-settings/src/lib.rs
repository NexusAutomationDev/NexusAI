use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

const SERVICE: &str = "nexusai";

/// StreamEvent is the CANONICAL event type for all streaming in NexusAI.
/// Phase 2+ must use this enum (or extend it) for all LLM token streaming.
/// NEVER use app.emit() in a loop — see RESEARCH.md §Anti-Patterns.
#[derive(Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum StreamEvent {
    Token { text: String },
    Done,
    Error { message: String },
}

#[derive(Debug, Serialize, Deserialize, specta::Type, Clone)]
pub struct ApiKeyStatus {
    pub configured: bool,
}

// Inner module isolates the #[tauri::command] + #[specta::specta] macros to avoid
// rustc 1.96 symbol collision when both macros generate `use` re-exports in the same scope.
// See: tauri-macros 2.6.x + specta-macros 2.0.0-rc.25 incompatibility on rustc 1.96.
pub mod commands {
    use super::*;
    use keyring::Entry;

    #[tauri::command]
    #[specta::specta]
    pub fn set_api_key(provider: String, key: String) -> Result<(), String> {
        // Validate provider is in allowed set — prevents keychain namespace injection
        let allowed = ["openai", "openrouter", "gemini"];
        if !allowed.contains(&provider.as_str()) {
            return Err(format!("Invalid provider: {provider}"));
        }
        let entry = Entry::new(SERVICE, &provider).map_err(|e| e.to_string())?;
        entry.set_password(&key).map_err(|e| e.to_string())
    }

    #[tauri::command]
    #[specta::specta]
    pub fn get_api_key_status(provider: String) -> Result<ApiKeyStatus, String> {
        let allowed = ["openai", "openrouter", "gemini"];
        if !allowed.contains(&provider.as_str()) {
            return Err(format!("Invalid provider: {provider}"));
        }
        let entry = Entry::new(SERVICE, &provider).map_err(|e| e.to_string())?;
        Ok(ApiKeyStatus {
            configured: entry.get_password().is_ok(),
        })
    }

    #[tauri::command]
    #[specta::specta]
    pub fn delete_api_key(provider: String) -> Result<(), String> {
        let allowed = ["openai", "openrouter", "gemini"];
        if !allowed.contains(&provider.as_str()) {
            return Err(format!("Invalid provider: {provider}"));
        }
        let entry = Entry::new(SERVICE, &provider).map_err(|e| e.to_string())?;
        entry.delete_credential().map_err(|e| e.to_string())
    }

    /// Demo command — validates the Channel API pattern works end-to-end.
    /// Phase 2 replaces this with real LLM streaming via reqwest.
    /// The function signature and Channel<StreamEvent> usage are the canonical template.
    /// T-01-04-01: bounded by prompt word count; Phase 2 must add max-token guard.
    #[tauri::command]
    #[specta::specta]
    pub async fn stream_llm_demo(
        prompt: String,
        on_event: Channel<StreamEvent>,
    ) -> Result<(), String> {
        // Simulate token-by-token streaming (one token per word)
        let words: Vec<&str> = prompt.split_whitespace().collect();
        for word in words {
            on_event
                .send(StreamEvent::Token { text: format!("{word} ") })
                .map_err(|e| e.to_string())?;
            // Small delay to simulate streaming latency (remove in Phase 2 real impl)
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        on_event.send(StreamEvent::Done).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Returns the Tauri invoke handler for all settings commands.
    /// Must be called from within this module so generate_handler! can resolve the hidden macros.
    pub fn invoke_handler<R: tauri::Runtime>() -> impl Fn(tauri::ipc::Invoke<R>) -> bool {
        tauri::generate_handler![set_api_key, get_api_key_status, delete_api_key, stream_llm_demo]
    }

    /// Returns a tauri-specta Commands value for TypeScript binding export.
    /// Must be called from within this module so collect_commands! can resolve the hidden macros.
    pub fn collect<R: tauri::Runtime>() -> tauri_specta::Commands<R> {
        tauri_specta::collect_commands![set_api_key, get_api_key_status, delete_api_key, stream_llm_demo]
    }
}

/// Returns the Tauri invoke handler for all settings commands.
pub fn invoke_handler<R: tauri::Runtime>() -> impl Fn(tauri::ipc::Invoke<R>) -> bool {
    commands::invoke_handler()
}

/// Returns tauri-specta Commands for TypeScript binding export.
pub fn collect_commands<R: tauri::Runtime>() -> tauri_specta::Commands<R> {
    commands::collect()
}

/// Internal use only — never exposed as Tauri command. Used by other Rust modules.
pub fn read_api_key_internal(provider: &str) -> Option<String> {
    use keyring::Entry;
    Entry::new(SERVICE, provider).ok()?.get_password().ok()
}
