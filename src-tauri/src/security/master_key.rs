//! Master Key + Generalized Vault.
//!
//! Phase 1 ships a Vault abstraction informed by:
//! - `savant-backup/crates/core/src/crypto.rs` — AgentKeyPair + 5-strategy cascade.
//! - `hermes-rs/OAUTH_DESIGN.md` — multi-profile Vault with `env:VAR` secret_ref.
//!
//! Five-strategy cascade (preserved from savant-backup, Strategy 5 changed to UI-prompt):
//!   1. `SAVANT_<PROVIDER>_API_KEY` env var
//!   2. cwd `.env` (developer convenience)
//!   3. exe-dir `.env` (packaged app)
//!   4. JSON vault file at OS app-data dir
//!      (Windows: `%APPDATA%/savant/auth.json` / Unix: `~/.config/savant/auth.json`)
//!   5. UI prompt (`MasterKeySetup.tsx`) → persist to vault file
//!
//! Unix perms enforced 0o600. Windows default ACL for Phase 1; DPAPI integration
//! deferred to Phase 5 per the FID.

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum VaultError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("Invalid key format")]
    InvalidKeyFormat,
    #[error("Vault file path resolution failed")]
    PathError,
    #[error("Profile '{0}' not found in vault")]
    ProfileNotFound(String),
}

pub type Result<T> = std::result::Result<T, VaultError>;

// ---------------------------------------------------------------------------
// AgentKeyPair — port of savant-backup crates/core/src/crypto.rs
// Used for agent identity signing / verification (Phase 2 cognitive core).
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentKeyPair {
    pub public_key: String,
    pub secret_key: String,
    pub key_id: String,
    pub created_at: i64,
}

impl AgentKeyPair {
    pub fn generate() -> Result<Self> {
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();
        Ok(AgentKeyPair {
            public_key: hex::encode(verifying_key.as_bytes()),
            secret_key: hex::encode(signing_key.as_bytes()),
            key_id: Uuid::new_v4().to_string(),
            created_at: chrono::Utc::now().timestamp(),
        })
    }

    pub fn get_verifying_key(&self) -> std::result::Result<VerifyingKey, VaultError> {
        let bytes = hex::decode(&self.public_key).map_err(|_| VaultError::InvalidKeyFormat)?;
        if bytes.len() != 32 {
            return Err(VaultError::InvalidKeyFormat);
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        VerifyingKey::from_bytes(&arr).map_err(|_| VaultError::InvalidKeyFormat)
    }

    pub fn get_signing_key(&self) -> std::result::Result<SigningKey, VaultError> {
        let bytes = hex::decode(&self.secret_key).map_err(|_| VaultError::InvalidKeyFormat)?;
        if bytes.len() != 32 {
            return Err(VaultError::InvalidKeyFormat);
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(SigningKey::from_bytes(&arr))
    }

    pub fn sign_message(&self, message: &str) -> Result<String> {
        let sk = self.get_signing_key()?;
        let sig = sk.sign(message.as_bytes());
        Ok(hex::encode(sig.to_bytes()))
    }

    pub fn verify_message(&self, message: &str, signature: &str) -> Result<bool> {
        let vk = self.get_verifying_key()?;
        let sig_bytes = hex::decode(signature).map_err(|_| VaultError::InvalidKeyFormat)?;
        if sig_bytes.len() != 64 {
            return Err(VaultError::InvalidKeyFormat);
        }
        let mut arr = [0u8; 64];
        arr.copy_from_slice(&sig_bytes);
        let signature = Signature::from_bytes(&arr);
        Ok(vk.verify(message.as_bytes(), &signature).is_ok())
    }
}

// ---------------------------------------------------------------------------
// Vault — generalized multi-profile (per hermes-rs OAUTH_DESIGN.md schema)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderProfile {
    pub provider: String,
    pub method: String, // "api_key" | "oauth_pkce" | "bearer" | "noauth"
    pub base_url: Option<String>,
    pub secret_ref: String, // "env:VAR" reference; secrets never inline
    pub scopes: Vec<String>, // future OAuth scopes
    pub expires_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    pub version: u32,
    pub profiles: HashMap<String, ProviderProfile>, // profile-name (e.g. "openrouter-default") → profile
    #[serde(default = "default_identity")]
    pub agent_identity: AgentKeyPair,
}

fn default_identity() -> AgentKeyPair {
    AgentKeyPair::generate().expect("OS RNG must produce keys")
}

impl Default for Vault {
    fn default() -> Self {
        Vault {
            version: 1,
            profiles: HashMap::new(),
            agent_identity: default_identity(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProfileSummary {
    pub name: String,
    pub provider: String,
    pub method: String,
    pub secret_ref_kind: String,
    pub base_url: Option<String>,
    pub updated_at: i64,
}

/// Returns the platform-appropriate vault file path.
///
/// Windows: `%APPDATA%/savant/auth.json`
/// Unix: `~/.config/savant/auth.json`
pub fn vault_file_path() -> Result<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").map_err(|_| VaultError::PathError)?;
        Ok(PathBuf::from(appdata).join("savant").join("auth.json"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").map_err(|_| VaultError::PathError)?;
        Ok(PathBuf::from(home).join(".config").join("savant").join("auth.json"))
    }
}

fn read_vault_file(path: &PathBuf) -> Result<Vault> {
    let json = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&json)?)
}

fn write_vault_file(vault: &Vault, path: &PathBuf) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(vault)?;

    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let mut f = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(path)?;
        f.write_all(json.as_bytes())?;
        f.sync_all()?;
    }

    #[cfg(not(unix))]
    {
        // Windows: default ACL for Phase 1. DPAPI integration is Phase 5.
        fs::write(path, json)?;
    }

    Ok(())
}

/// Load the vault from disk, or return `Vault::default()` (Strategy 5 placeholder).
pub async fn load_vault() -> Result<Vault> {
    if let Some(path) = vault_file_path().ok() {
        if path.exists() {
            return read_vault_file(&path);
        }
    }
    // Strategy 5 placeholder: empty vault, UI prompts to populate.
    Ok(Vault::default())
}

/// Resolve a secret-referenced-environment-variable (e.g. `env:OPENROUTER_API_KEY`).
pub fn resolve_secret(secret_ref: &str) -> Result<String> {
    if let Some(var) = secret_ref.strip_prefix("env:") {
        std::env::var(var).map_err(|_| VaultError::InvalidKeyFormat)
    } else {
        Err(VaultError::InvalidKeyFormat)
    }
}

/// Save (or update) a provider profile and write the vault to disk.
pub async fn save_profile(provider_name: &str, api_key: &str) -> Result<()> {
    let mut vault = load_vault().await?;
    let now = chrono::Utc::now().timestamp();
    let env_var = format!(
        "SAVANT_{}_API_KEY",
        provider_name.to_uppercase().replace('-', "_")
    );
    std::env::set_var(&env_var, api_key);

    let profile_name = format!("{}-default", provider_name);
    let base_url = match provider_name {
        "openrouter" => Some("https://openrouter.ai/api/v1".to_string()),
        _ => None,
    };

    vault.profiles.insert(
        profile_name.clone(),
        ProviderProfile {
            provider: provider_name.to_string(),
            method: "api_key".to_string(),
            base_url,
            secret_ref: format!("env:{}", env_var),
            scopes: vec![],
            expires_at: None,
            created_at: now,
            updated_at: now,
        },
    );

    let path = vault_file_path()?;
    write_vault_file(&vault, &path)?;
    tracing::info!("[vault] saved profile {} → {}", profile_name, path.display());
    Ok(())
}

/// Resolve a profile's api key from the persisted env-reference.
pub async fn lookup_api_key(profile_name: &str) -> Result<String> {
    let vault = load_vault().await?;
    let profile = vault
        .profiles
        .get(profile_name)
        .ok_or_else(|| VaultError::ProfileNotFound(profile_name.to_string()))?;
    resolve_secret(&profile.secret_ref)
}

/// Lists profiles for UI inspection. Does not return the api key itself.
pub async fn list_profiles() -> Result<Vec<ProfileSummary>> {
    let vault = load_vault().await?;
    Ok(vault
        .profiles
        .iter()
        .map(|(name, p)| ProfileSummary {
            name: name.clone(),
            provider: p.provider.clone(),
            method: p.method.clone(),
            secret_ref_kind: p.secret_ref.split(':').next().unwrap_or("unknown").to_string(),
            base_url: p.base_url.clone(),
            updated_at: p.updated_at,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agent_keypair_sign_verify_roundtrip() {
        let kp = AgentKeyPair::generate().unwrap();
        let msg = "hello world";
        let sig = kp.sign_message(msg).unwrap();
        assert!(kp.verify_message(msg, &sig).unwrap());
        assert!(!kp.verify_message("tampered", &sig).unwrap());
    }

    #[test]
    fn resolve_env_secret_ref() {
        std::env::set_var("TEST_VAULT_VAR", "secret-value");
        let resolved = resolve_secret("env:TEST_VAULT_VAR").unwrap();
        assert_eq!(resolved, "secret-value");
    }

    #[test]
    fn reject_non_env_secret_ref() {
        let err = resolve_secret("plain-string").unwrap_err();
        assert!(matches!(err, VaultError::InvalidKeyFormat));
    }
}
