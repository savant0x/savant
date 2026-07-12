//! Savant — Phase 1 daemon.
//!
//! Tauri 2 surface that exposes three IPC commands:
//! - `setup_master_key(provider, api_key)`  — persist a provider profile to vault.
//! - `infer_openrouter(prompt)`              — single chat-completion smoke test.
//! - `vault_list_profiles()`                 — UI-inspectable profile list.
//!
//! Per FID-2026-07-11-001, IPC types are initially typed as `Value` at the
//! boundary. Full tauri-specta v2 TS bindings will be added in Phase 2.

pub mod inference;
pub mod security;

use crate::security::master_key::{self, ProfileSummary};
use crate::inference::openrouter;

/// Save (or update) a provider profile in the OS app-data vault.
#[tauri::command]
async fn setup_master_key(provider: String, api_key: String) -> Result<(), String> {
    master_key::save_profile(&provider, &api_key)
        .await
        .map_err(|e| e.to_string())
}

/// Send a single chat completion prompt to OpenRouter and return the reply.
#[tauri::command]
async fn infer_openrouter(prompt: String) -> Result<String, String> {
    openrouter::chat_completion(&prompt)
        .await
        .map_err(|e| e.to_string())
}

/// List profiles currently in the vault. Never returns the api-key itself.
#[tauri::command]
async fn vault_list_profiles() -> Result<Vec<ProfileSummary>, String> {
    master_key::list_profiles()
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(false)
        .compact()
        .init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            setup_master_key,
            infer_openrouter,
            vault_list_profiles,
        ])
        .setup(|app| {
            tracing::info!(
                "Savant Phase 1 starting; vault dir = {:?}",
                master_key::vault_file_path()
            );
            let _ = app.handle();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Savant Phase 1 daemon");
}
