//! `savant_cli::cli` — clap definitions for the Savant CLI runtime
//! host (FID-030 §Step 3 module split).
//!
//! Moved out of `lib.rs` at FID-030 §Step 3 per FID-030 spec
//! §Detailed Description §Step 3 + §Impact Assessment:
//!
//! > **§Step 3:** Create the clap definitions — `crates/cli/src/cli.rs`
//! > with the `Cli` + `Command` + `MemoryAction` + `VaultAction`
//! > enums per §Subcommand Tree above.
//!
//! `lib.rs` re-exports `Cli + Command + MemoryAction + VaultAction`
//! from this module so callers (tests, subcommand modules,
//! `savant_cli::run()`, `commands::dispatch(&Cli)`) can continue to
//! use `savant_cli::Cli`, `savant_cli::Command`, etc. without
//! changing their import paths.
//!
//! ## §Step history
//!
//! - §Step 1: scaffold only — single-file `lib.rs` with `Args` struct
//!   + `Command::Run` placeholder (commit `3f42bcd`).
//! - §Step 2: full clap tree — `Args` → `Cli` rename (struct),
//!   `Command::Run` → `Command::Dev { watch: bool }` rename +
//!   full surface (`Chat` / `Memory { action }` / `Vault { action
//!   }` / `Doctor`) + nested `MemoryAction` + `VaultAction` +
//!   6 global flags including short+long verbatim `-v`/`--verbose`
//!   count. Lin in `lib.rs` (commit `0c4feb2`).
//! - §Step 3: this file — enums moved out of `lib.rs` to `cli.rs`
//!   per spec §Step 3; `lib.rs` re-exports for caller compatibility.

use clap::{ArgAction, Parser, Subcommand};

/// Top-level CLI arguments. `clap::Parser` derives `Cli::parse()`
/// from `std::env::args()`; tests use `Cli::parse_from(&[...])`.
///
/// §Step 2: renamed from §Step 1's `Args` to `Cli` per FID-030 spec.
/// §Step 3: moved to this dedicated module per spec §Step 3.
#[derive(Debug, Parser)]
#[command(
    name = "savant",
    version,
    about = "Savant CLI runtime host (FID-030 Layer 2 Strangler-Fig migration — ZeroClaw pattern)",
    long_about = "The CLI is the runtime host: it imports savant_gateway + savant_runtime directly. \
                  Default subcommand starts the gateway in-process + opens the dashboard. \
                  See `savant dev --help` for the full default-mode surface."
)]
pub struct Cli {
    /// Subcommand to execute. Bare `savant` (no subcommand) prints
    /// clap's auto-generated help and exits 0.
    #[command(subcommand)]
    pub command: Option<Command>,

    /// Port for the gateway (default 3001; matches savant_gateway default).
    /// (FID-030 §Decisions Q6.)
    #[arg(long, global = true, default_value = "3001")]
    pub gateway_port: u16,

    /// Port for the Next.js dashboard (default 3000; only used in dev mode).
    #[arg(long, global = true, default_value = "3000")]
    pub dashboard_port: u16,

    /// Skip opening the browser on startup (for headless servers / CI).
    /// (FID-030 §Decisions Q5.)
    #[arg(long, global = true)]
    pub no_browser: bool,

    /// Custom config file path (TOML; `~/.config/savant/config.toml` by default).
    /// (FID-030 §Missed Questions Q1.)
    #[arg(long, global = true)]
    pub config: Option<String>,

    /// Log level (alternative to `-v` counting; e.g. `info`, `debug`, `trace`).
    /// (FID-030 §Missed Questions Q7 / §Suggestions G.)
    #[arg(long, global = true)]
    pub log_level: Option<String>,

    /// Verbosity counter (`-v`, `-vv`, `-vvv`; long form `--verbose`).
    /// Both short + long forms are accepted so `savant -vvv doctor` and
    /// `savant --verbose --verbose --verbose doctor` parse identically.
    #[arg(short = 'v', long = "verbose", global = true, action = ArgAction::Count)]
    pub verbose: u8,
}

/// Subcommand enum. Per FID-030 spec §Subcommand Tree.
#[derive(Debug, Subcommand)]
pub enum Command {
    /// Default — boot the full Savant runtime (gateway + browser open).
    /// §Step 4: real implementation lands at `commands::dev::handle`.
    Dev {
        /// Use `next dev` instead of static export (hot reload).
        #[arg(long, action = ArgAction::SetTrue)]
        watch: bool,
    },
    /// CLI REPL — stub at §Step 3; real implementation at FID-031+
    /// / Layer 3.
    /// §Step 11: stub body lands at `commands::chat::handle`.
    Chat,
    /// Memory engine subcommands.
    /// §Step 11: stub body lands at `commands::memory::handle`.
    Memory {
        #[command(subcommand)]
        action: MemoryAction,
    },
    /// Vault subcommands. Per ECHO Law 12, `Show` NEVER returns raw
    /// key bytes — only redacted summaries.
    /// §Step 11: stub body lands at `commands::vault::handle`.
    Vault {
        #[command(subcommand)]
        action: VaultAction,
    },
    /// Health checks (gateway reachability + dashboard readiness +
    /// port negotiation + memory engine init + vault file readable).
    /// §Step 11: stub body lands at `commands::doctor::handle`
    /// (partial `GET /v1/health`).
    Doctor,
}

/// Memory subcommand enum (FID-030 spec §Subcommand Tree — Memory
/// section, lines 207-220 of the FID doc).
#[derive(Debug, Subcommand)]
pub enum MemoryAction {
    /// Search across all sessions (gateway `/v1/memory/search`).
    Search {
        query: String,
        #[arg(long, default_value = "10")]
        limit: usize,
    },
    /// List all sessions (gateway `/v1/memory/sessions`).
    List,
}

/// Vault subcommand enum (FID-030 spec §Subcommand Tree — Vault
/// section, lines 222-232 of the FID doc).
#[derive(Debug, Subcommand)]
pub enum VaultAction {
    /// List all profiles (gateway `/v1/vault/profiles`).
    List,
    /// Show a redacted profile summary
    /// (gateway `/v1/vault/profiles/<name>`; never key bytes —
    /// ECHO Law 12).
    Show {
        name: String,
    },
}
