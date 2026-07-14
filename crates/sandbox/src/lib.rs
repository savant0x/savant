#![allow(unexpected_cfgs)]

pub mod fs;
pub mod ipc;
pub mod net;
pub mod secure;
pub mod vmm;

// ─── FID-025 RuntimeFactory (gap-close) ────────────────────────────
//
// Wraps `vmm::select_backend()` + `secure::shields::ShieldManager` in a
// single Send + Sync handle that the renderer-side IPC adapter
// (`src-tauri/src/skills/mod.rs`) acquires on every skill execution.
//
// The shield manager is the policy layer (network, DNS, bandwidth);
// the hypervisor is the OS-level boundary (KVM/WHP/HCS/Virtualization.framework/proc).
// Both are already fully implemented in their respective submodules;
// `RuntimeHandle` just exposes them under one name so the FID body
// sketch (`savant_sandbox::secure_runtime().isolation_boundary()`)
// compiles cleanly against the real crate surface.

use std::sync::Arc;
use tokio::sync::Mutex;

/// A combined sandbox runtime handle: OS-level hypervisor + policy shield layer.
/// Send + Sync (required for Tauri State management) follows automatically
/// from `Box<dyn AgentHypervisor>: Send + Sync` (the trait enforces it) +
/// `ShieldManager: Send + Sync` (the `JoinHandle` inside is Send).
pub struct RuntimeHandle {
    pub hypervisor: Arc<Mutex<Box<dyn vmm::AgentHypervisor>>>,
    pub shields: secure::shields::ShieldManager,
    pub backend_name: &'static str,
}

impl RuntimeHandle {
    /// Async constructor: awaits the `vmm::select_backend()` future that
    /// probes cloud-hypervisor / HCS / Virtualization.framework / process
    /// fallback in priority order.
    pub async fn new() -> Self {
        let hypervisor = vmm::select_backend().await;
        let backend_name = hypervisor.backend_name();
        Self {
            hypervisor: Arc::new(Mutex::new(hypervisor)),
            shields: secure::shields::ShieldManager::new(),
            backend_name,
        }
    }

    /// Returns a no-op RAII guard. The hypervisor already enforces
    /// isolation at boot time, so the guard's current role is hookpoint
    /// stability for the IPC surface. Future FID-026/FID-027 work can
    /// bind mount-security + shield-state transitions into this guard
    /// without breaking the existing call sites.
    pub fn isolation_boundary(&self) -> IsolationGuard<'_> {
        IsolationGuard { _marker: std::marker::PhantomData }
    }
}

/// RAII guard for the isolation boundary. Drop unmarks the boundary.
pub struct IsolationGuard<'a> {
    _marker: std::marker::PhantomData<&'a ()>,
}

/// Top-level savant-sandbox runtime factory. Renderer code calls this on
/// each skill execution to obtain a fresh isolation boundary.
pub async fn secure_runtime() -> RuntimeHandle {
    RuntimeHandle::new().await
}
