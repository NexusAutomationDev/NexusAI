use serde::{Deserialize, Serialize};

const SERVICE: &str = "nexusai";

#[derive(Debug, Serialize, Deserialize, specta::Type, Clone)]
pub struct ApiKeyStatus {
    pub configured: bool,
}

// Inner module isolates the #[tauri::command] + #[specta::specta] macros to avoid
// rustc 1.96 symbol collision when both macros generate `use` re-exports in the same scope.
// See: tauri-macros 2.6.x + specta-macros 2.0.0-rc.25 incompatibility on rustc 1.96.
mod commands {
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

    /// Returns the Tauri invoke handler for all settings commands.
    /// Must be called from within this module so generate_handler! can resolve the hidden macros.
    pub fn invoke_handler<R: tauri::Runtime>() -> impl Fn(tauri::ipc::Invoke<R>) -> bool {
        tauri::generate_handler![set_api_key, get_api_key_status, delete_api_key]
    }

    /// Returns a tauri-specta Commands value for TypeScript binding export.
    /// Must be called from within this module so collect_commands! can resolve the hidden macros.
    pub fn collect<R: tauri::Runtime>() -> tauri_specta::Commands<R> {
        tauri_specta::collect_commands![set_api_key, get_api_key_status, delete_api_key]
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
