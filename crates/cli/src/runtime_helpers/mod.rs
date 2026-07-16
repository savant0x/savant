//! `savant_cli::runtime_helpers` -- runtime host support utilities
//! (FID-030 §Step 4).
//!
//! Per FID-030 spec §Steps 7-10 + §Impact Assessment §File Structure,
//! this module houses the 4 runtime host helpers used by
//! `commands::dev::handle` (which lands at FID-030 §Step 5):
//!
//! - [`port`] -- port availability + negotiation (spec §Step 8).
//! - [`signal`] -- OS signal handling via `tokio::signal::ctrl_c`
//!   (spec §Step 9).
//! - [`browser`] -- default-browser launch wrapper (spec §Step 10).
//! - [`process`] -- child-process spawn + readiness poll + tree-kill
//!   (spec §Step 7).
//!
//! Each helper returns `Result<T, SavantCliError>` per the existing
//! crate-wide error discipline (ECHO Law 14 federated error
//! handling). New `SavantCliError` variants (Port / Signal / Spawn /
//! Browser) land in this commit per the FID-030 §Step 4 scope.
//!
//! ## §Step 4 rationale (reordering per LESSON-038)
//!
//! The FID-030 spec §Steps enumeration places `commands/dev.rs`
//! (§Step 5) BEFORE these helpers (§Steps 7-10). Per LESSON-038
//! (no-unilateral-defer) + LESSON-062 (path discipline), this
//! helper-first ordering is a pragmatic deviation: helpers must
//! compile before the orchestrator that consumes them, otherwise
//! the §Step 5 commit would carry dozens of dead-code warnings.
//! The spec's literal `commands/dev.rs` §Step 5 lands at our §Step
//! 5 in the next commit, after these helpers are validated.
//!
//! ## Dep minimality (per LESSON-038)
//!
//! - `tokio = { workspace = true }` -- workspace `tokio = { version
//!   = "1.0", features = ["full"] }` covers `process`, `net`,
//!   `signal` (incl `tokio::signal::ctrl_c`). No additional tokio
//!   sub-deps needed at the crate level.
//! - `webbrowser = "0.8"` -- new workspace dep; no alternatives in
//!   the existing tree.
//! - `ctrlc` + `nix` from spec are NOT added. We use
//!   `tokio::signal::ctrl_c()` instead of `ctrlc::set_handler`
//!   (avoids duplicate signal-handling deps). The spec's `nix`
//!   requirement for Unix process-group kill is replaced with
//!   `tokio::process::Child::kill()` (portable, best-effort).
//!   Process-group orphan grandchild risk documented in
//!   `process::kill_process_tree` doc-comment.

pub mod browser;
pub mod port;
pub mod process;
pub mod signal;