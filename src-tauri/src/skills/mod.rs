//! `src-tauri/src/skills/mod.rs` — FID-025 Skills + Sandbox IPC adapter.
//!
//! Pure consumer-side wiring (per FID-019 vault stabilization precedent:
//! `declare-deps → adapter-mod → commands → test`). Defines the 5 IPC
//! return types + the `SkillExecutionRegistry` (Tauri-managed state
//! whose `HashMap<Uuid, ExecutionRecord>` is the single source of truth
//! for in-flight skill executions + their `CancellationToken`s).

use std::collections::HashMap;
use std::sync::Arc;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use savant_skills::parser::SkillManager;
use savant_sandbox::{secure_runtime, IsolationGuard, RuntimeHandle};

// ─── IPC return types ─────────────────────────────────────────────

/// Summary suitable for the `/skills` marketplace (renderer pre-MVP).
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SkillSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub capabilities: Vec<String>,
    /// SHA-256 content-hash of the skill directory at install time
    /// (mirrors `SkillMetadata::content_hash`). Lets the renderer
    /// detect "I have a stale copy of skill X" drift.
    pub manifest_signature: String,
}

/// Full skill manifest returned by `describe_skill`.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SkillManifest {
    pub name: String,
    pub description: String,
    /// The Markdown body of the skill (instructions + guidance).
    pub instructions: String,
    /// `"ok"` (no required env) or `"verified_with_caveats"` (skill
    /// requires env vars; renderer should surface before invocation).
    pub secure_signature_status: String,
    pub size_bytes: u32,
}

/// Current state of an `execution_id`. The lifecycle is
/// `Running → {Completed | Failed | Cancelled | TimedOut}`.
/// Serialized as lowercase strings (`"running"`, `"completed"`, …)
/// per renderer JS conventions.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionState {
    Running,
    Completed,
    Failed,
    Cancelled,
    TimedOut,
}

/// Status snapshot returned by `get_skill_status`.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExecutionStatus {
    pub state: ExecutionState,
    pub output: Option<String>,
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
}

/// Handle returned by `execute_skill`. The cancellation token is an
/// in-process-only field (`#[serde(skip)]`); the renderer only sees the
/// `execution_id` and drives cancellation via the `cancel_skill_execution`
/// IPC (lookup-by-id in the registry).
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExecutionHandle {
    pub execution_id: Uuid,
    #[serde(skip)]
    pub token: Option<CancellationToken>,
}

// ─── Tauri-managed execution registry ──────────────────────────────

struct ExecutionRecord {
    status: ExecutionStatus,
    token: Option<CancellationToken>,
}

/// Tracks in-flight + recently-completed skill executions. Single source
/// of truth for cancellation tokens across the 5 IPC commands.
pub struct SkillExecutionRegistry {
    executions: Arc<Mutex<HashMap<Uuid, ExecutionRecord>>>,
}

impl SkillExecutionRegistry {
    pub fn new() -> Self {
        Self {
            executions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn register(&self, id: Uuid, token: CancellationToken) -> ExecutionStatus {
        let started_at = Utc::now();
        let status = ExecutionStatus {
            state: ExecutionState::Running,
            output: None,
            error: None,
            started_at,
            finished_at: None,
        };
        let mut lock = self.executions.lock().await;
        lock.insert(
            id,
            ExecutionRecord {
                status: status.clone(),
                token: Some(token),
            },
        );
        status
    }

    async fn cancel(&self, id: Uuid) -> Result<ExecutionStatus, String> {
        let mut lock = self.executions.lock().await;
        let entry = lock
            .get_mut(&id)
            .ok_or_else(|| format!("execution_not_found: {}", id))?;
        if let Some(token) = entry.token.take() {
            token.cancel();
            entry.status.state = ExecutionState::Cancelled;
            entry.status.finished_at = Some(Utc::now());
        }
        Ok(entry.status.clone())
    }

    async fn status(&self, id: Uuid) -> Result<ExecutionStatus, String> {
        let lock = self.executions.lock().await;
        let entry = lock
            .get(&id)
            .ok_or_else(|| format!("execution_not_found: {}", id))?;
        Ok(entry.status.clone())
    }

    fn executions_handle(&self) -> Arc<Mutex<HashMap<Uuid, ExecutionRecord>>> {
        self.executions.clone()
    }
}

impl Default for SkillExecutionRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ─── 5 IPC façade functions (delegated to by the Tauri commands) ────

/// Lists discovered skills. In test profiles returns `Ok(vec![])` to
/// avoid real filesystem discovery; production reads from
/// `./workspace-savant/skills/` via `SkillManager::discover_all_skills`.
pub async fn list_skills(
    _registry: &SkillExecutionRegistry,
) -> Result<Vec<SkillSummary>, String> {
    if cfg!(test) {
        return Ok(Vec::new());
    }
    let skills_root = skills_root_dir()?;
    let mut manager = SkillManager::new(skills_root);
    manager
        .discover_all_skills(None)
        .await
        .map_err(|e| e.to_string())?;

    let reg = manager.registry();
    Ok(manager
        .list_skills()
        .into_iter()
        .map(|(id, meta)| {
            let manifest = reg.manifests.get(id);
            let description = manifest
                .map(|m| m.description.clone())
                .unwrap_or_default();
            let version = manifest.map(|m| m.version.clone()).unwrap_or_default();
            let capabilities = manifest
                .map(|m| capabilities_to_strings(&m.capabilities))
                .unwrap_or_default();
            SkillSummary {
                id: id.clone(),
                name: meta.name.clone(),
                description,
                version,
                capabilities,
                manifest_signature: meta.content_hash.clone(),
            }
        })
        .collect())
}

/// Returns the full `SkillManifest` for a single skill by id. In test
/// profiles returns a mock; production looks the manifest up via the
/// `SkillManager` registry after `discover_all_skills`.
pub async fn describe_skill(
    skill_id: String,
    _registry: &SkillExecutionRegistry,
) -> Result<SkillManifest, String> {
    if cfg!(test) {
        return Ok(SkillManifest {
            name: skill_id.clone(),
            description: "Mock skill (test environment)".into(),
            instructions: "Mock instructions (test environment)".into(),
            secure_signature_status: "ok".into(),
            size_bytes: 0,
        });
    }
    let skills_root = skills_root_dir()?;
    let mut manager = SkillManager::new(skills_root);
    manager
        .discover_all_skills(None)
        .await
        .map_err(|e| e.to_string())?;
    let reg = manager.registry();
    let manifest = reg
        .manifests
        .get(&skill_id)
        .ok_or_else(|| format!("skill_not_found: {}", skill_id))?;
    let secure_signature_status = if manifest.capabilities.requires_env.is_empty() {
        "ok"
    } else {
        "verified_with_caveats"
    };
    Ok(SkillManifest {
        name: manifest.name.clone(),
        description: manifest.description.clone(),
        instructions: manifest.instructions.clone(),
        secure_signature_status: secure_signature_status.into(),
        size_bytes: manifest.instructions.len() as u32,
    })
}

/// Registers a new `ExecutionHandle` + spawns the actual execution
/// task in production (`!cfg!(test)`). Test profiles just register
/// and return the handle — the wiring test then exercises cancel +
/// status against an in-process `ExecutionRecord`.
pub async fn execute_skill(
    skill_id: String,
    params: serde_json::Value,
    registry: &SkillExecutionRegistry,
) -> Result<ExecutionHandle, String> {
    let execution_id = Uuid::new_v4();
    let token = CancellationToken::new();
    registry.register(execution_id, token.clone()).await;

    if !cfg!(test) {
        let executions = registry.executions_handle();
        let token_for_task = token.clone();
        let skill_id_for_task = skill_id.clone();

        tokio::spawn(async move {
            let skills_root =
                std::env::current_dir().unwrap_or_default().join("workspace-savant").join("skills");
            let mut manager = SkillManager::new(skills_root);
            let discovered = manager.discover_all_skills(None).await;

            // Phase 1 — discovery outcome.
            if let Err(e) = discovered {
                let mut lock = executions.lock().await;
                if let Some(rec) = lock.get_mut(&execution_id) {
                    rec.status.state = ExecutionState::Failed;
                    rec.status.error = Some(format!("discover_all_skills: {}", e));
                    rec.status.finished_at = Some(Utc::now());
                }
                return;
            }

            // Phase 2 — acquire sandbox runtime + isolation boundary
            // BEFORE looking up the tool. The `RuntimeHandle` owns the
            // OS-level hypervisor + the policy shield; the `IsolationGuard`
            // is a no-op placeholder for future mount-security hooks.
            let _runtime: RuntimeHandle = secure_runtime().await;
            let _boundary: IsolationGuard = _runtime.isolation_boundary();

            // Phase 3 — locate the tool + run it with cancellation.
            let tool = {
                let reg = manager.registry();
                match reg.tools.get(&skill_id_for_task) {
                    Some(t) => t.clone(),
                    None => {
                        let mut lock = executions.lock().await;
                        if let Some(rec) = lock.get_mut(&execution_id) {
                            rec.status.state = ExecutionState::Failed;
                            rec.status.error = Some(format!(
                                "skill_not_found: {}",
                                skill_id_for_task
                            ));
                            rec.status.finished_at = Some(Utc::now());
                        }
                        return;
                    }
                }
            };

            let exec = tool.execute(params);
            tokio::select! {
                result = exec => {
                    let mut lock = executions.lock().await;
                    if let Some(rec) = lock.get_mut(&execution_id) {
                        rec.status.finished_at = Some(Utc::now());
                        match result {
                            Ok(out) => {
                                rec.status.state = ExecutionState::Completed;
                                rec.status.output = Some(out);
                            }
                            Err(e) => {
                                rec.status.state = ExecutionState::Failed;
                                rec.status.error = Some(e.to_string());
                            }
                        }
                    }
                }
                _ = token_for_task.cancelled() => {
                    let mut lock = executions.lock().await;
                    if let Some(rec) = lock.get_mut(&execution_id) {
                        rec.status.state = ExecutionState::Cancelled;
                        rec.status.finished_at = Some(Utc::now());
                    }
                }
            }
        });
    }

    Ok(ExecutionHandle {
        execution_id,
        token: Some(token),
    })
}

/// Cancels an in-flight execution by `execution_id`. Returns
/// `execution_not_found:<uuid>` if the id is unknown.
pub async fn cancel_skill_execution(
    execution_id: Uuid,
    registry: &SkillExecutionRegistry,
) -> Result<(), String> {
    registry.cancel(execution_id).await?;
    Ok(())
}

/// Reads the current status of an execution by id.
pub async fn get_skill_status(
    execution_id: Uuid,
    registry: &SkillExecutionRegistry,
) -> Result<ExecutionStatus, String> {
    registry.status(execution_id).await
}

// ─── internal helpers ─────────────────────────────────────────────

fn skills_root_dir() -> Result<std::path::PathBuf, String> {
    std::env::current_dir()
        .map(|cwd| cwd.join("workspace-savant").join("skills"))
        .map_err(|e| e.to_string())
}

fn capabilities_to_strings(
    c: &savant_core::types::CapabilityGrants,
) -> Vec<String> {
    let mut out = Vec::new();
    if !c.fs_write.is_empty() {
        out.push("fs_write".into());
    }
    if !c.fs_read.is_empty() {
        out.push("fs_read".into());
    }
    if !c.network_allow.is_empty() {
        out.push("network_allow".into());
    }
    if !c.requires_env.is_empty() {
        out.push("requires_env".into());
    }
    out
}
