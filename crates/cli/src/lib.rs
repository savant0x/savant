//! `savant_cli` — Savant CLI runtime host library crate
//! (FID-030 §Step 3 module split).
//!
//! ## §Step 3 module structure (per FID-030 spec §Step 3 +
//! §Impact Assessment §File Structure)
//!
//! ```text
//! crates/cli/src/
//! \u251c\u2500\u2500 lib.rs         # this file: module declarations +
//!                                  # re-exports + SavantCliError +
//!                                  # `run()` entry point
//! \u251c\u2500\u2500 cli.rs         # clap definitions (Cli + Command +
//!                                  # MemoryAction + VaultAction enums);
//!                                  # §Step 2's content moved here at \u00a7Step 3
//! \u251c\u2500\u2500 commands/
//! \u2502   \u2514\u2500\u2500 mod.rs   # subcommand dispatcher
//!                                  # `commands::dispatch(&Cli)` + (at future
//!                                  # \u00a7Steps) per-subcommand handler
//!                                  # modules
//! \u251c\u2500\u2500 main.rs        # `fn main() \u2192 ExitCode` thin wrapper
//!                                  # around `savant_cli::run()`
//! ```
//!
//! ## §Step history
//!
//! - §Step 1: bootstrap scaffold (`Args` + `Command::Run` placeholder
//!   in single-file `lib.rs`; commit `3f42bcd`).
//! - §Step 2: full clap tree (`Args` \u2192 `Cli`, `Run` \u2192 `Dev { watch:
//!   bool }`, full subcommand surface + nested MemoryAction /
//!   VaultAction + 6 global flags + bin name `savant-cli` \u2192 `savant`;
//!   commit `0c4feb2`).
//! - §Step 3: this file \u2014 enums moved out to `cli.rs` per spec
//!   \u00a7Step 3; `commands/mod.rs` + `dispatch()` skeleton added;
//!   `run()` refactored to delegate to `commands::dispatch` (the
//!   per-subcommand handler modules `commands::{dev,chat,memory,
//!   vault,doctor}::handle` land at \u00a7Steps 4 + 11).
//!
//! ## Single-source-of-truth pattern
//!
//! Per FID-029 \u00a7Step 9, the lib's `run()` is the SOLE entry point
//! that owns process-exit handling; `main.rs` is a thin shim.

pub mod cli;
pub mod commands;
pub mod runtime_helpers;

// Re-exports from `cli` (callers + tests use these from `savant_cli::*`).
pub use cli::{Cli, Command, MemoryAction, VaultAction};

use clap::Parser;
use thiserror::Error;

/// Typed CLI errors \u2014 `thiserror` per `coding-standards/rust.md`.
/// `exit_code()` provides stable exit-code mapping (each variant gets
/// a distinct code so CI scripts can branch on the failure mode).
///
/// §Step 3: unchanged from §Step 2. Signal variant lands at §Step 5;
/// PortNegotiation at §Step 10; ApiClient at §Step 6+. No premature
/// addition per LESSON-062 (path discipline).
#[derive(Debug, Error)]
pub enum SavantCliError {
    /// `savant_runtime` initialisation failed (wired in §Step 4 via
    /// `commands::dev::handle`).
    #[error("savant_runtime init: {0}")]
    RuntimeInit(String),

    /// Gateway boot failed (port collision, readiness timeout).
    #[error("gateway boot: {0}")]
    GatewayBoot(String),

    /// Dashboard orchestration failed (`next dev` spawn, browser open).
    #[error("dashboard orchestration: {0}")]
    Dashboard(String),

    /// Port negotiation failed -- all +0..+9 fallback candidates
    /// are bound (FID-030 §Step 4 `port::negotiate_port`).
    #[error("port negotiation: {0}")]
    Port(String),

    /// OS signal handling failed -- `tokio::signal::ctrl_c()` error
    /// (FID-030 §Step 4 `signal::wait_for_shutdown`).
    #[error("signal handling: {0}")]
    Signal(String),

    /// Child-process spawn or tree-kill failed (FID-030 §Step 4
    /// `process::{spawn_npx, kill_process_tree, wait_for_http}`).
    #[error("process spawn/kill: {0}")]
    Spawn(String),

    /// Default-browser launch failed -- non-fatal UX failure; caller
    /// should log + print URL for manual open (FID-030 §Step 4
    /// `browser::open_browser`).
    #[error("browser open: {0}")]
    Browser(String),

    /// Catch-all for unforeseen propagated errors.
    #[error("savant-cli error: {0}")]
    Other(String),
}

impl SavantCliError {
    /// Stable exit-code mapping (FID-030 §Verifier Pass convention).
    ///
    /// §Step 4 mapping (extended):
    /// - 10: RuntimeInit
    /// - 11: GatewayBoot
    /// - 12: Dashboard
    /// - 13: Port
    /// - 14: Signal
    /// - 15: Spawn
    /// - 1: Browser (best-effort UX failure; falls back to manual URL)
    /// - 1: Other
    pub fn exit_code(&self) -> u8 {
        match self {
            SavantCliError::RuntimeInit(_) => 10,
            SavantCliError::GatewayBoot(_) => 11,
            SavantCliError::Dashboard(_) => 12,
            SavantCliError::Port(_) => 13,
            SavantCliError::Signal(_) => 14,
            SavantCliError::Spawn(_) => 15,
            SavantCliError::Browser(_) => 1,
            SavantCliError::Other(_) => 1,
        }
    }
}

/// savant-cli entry point. §Step 3: hands off to
/// `commands::dispatch(&cli)` for the per-subcommand routing. Each
/// per-subcommand handler module lands at its respective §Step
/// (see `commands/mod.rs` documentation block for the mapping).
///
/// The `Result<(), SavantCliError>` return type is preserved end-to-end
/// so when the real handlers (with their own failure modes \u2014 e.g.,
/// `commands::dev::handle` returning `Err(SavantCliError::RuntimeInit(_))`
/// at §Step 4 when `savant_runtime::Runtime::new(&config)` fails) land,
/// the failure propagates correctly through `dispatch` \u2192 `run()` \u2192
/// `main()` \u2192 `SavantCliError::exit_code()` and out as a stable exit code.
pub fn run() -> Result<(), SavantCliError> {
    let cli = Cli::parse();
    commands::dispatch(&cli)
}

/// Listing of currently-implemented subcommand names. Public so the
/// smoke test asserts the catalogue stays in sync as §Steps add
/// additional variants (or as FID-034's kernel traits expand the
/// CLI surface).
///
/// §Step 3: unchanged from §Step 2.
pub fn implemented_subcommands() -> &'static [&'static str] {
    &["dev", "chat", "memory", "vault", "doctor"]
}
