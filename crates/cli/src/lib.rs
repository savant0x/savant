//! `savant_cli` — Savant CLI runtime host (FID-030 §Step 2).
//!
//! Layer 2 of master FID-035 §Layered Build Order. Per the ZeroClaw
//! architecture, the CLI binary is the runtime host: it parses the
//! command line via clap, in-process initialises the gateway, spawns
//! `next dev` for the dashboard in dev mode, and serves embedded web
//! assets in prod mode.
//!
//! §Step 2 expands the clap tree to the full subcommand surface
//! (`Dev` / `Chat` / `Memory` / `Vault` / `Doctor`) + the nested
//! `MemoryAction` / `VaultAction` enums + global flag groups
//! (`--gateway-port`, `--dashboard-port`, `--no-browser`, `--config`,
//! `--log-level`, `-v` count). All subcommands are acknowledged via
//! `tracing::info!` at §Step 2; the actual handler implementations
//! (`commands/{dev,chat,memory,vault,doctor}.rs`) land at §Step 3,
//! runtime boot logic at §Step 4, signal handling at §Step 5.
//!
//! §Step 2 SPEC ALIGNMENT NOTE: `Args` (from §Step 1) is renamed to
//! `Cli` to match FID-030 spec verbatim (§Subcommand Tree example);
//! `Command::Run` (from §Step 1) is renamed to `Command::Dev { watch: bool }`
//! to match spec §Default Behavior. Bin name is `savant` per spec
//! (was `savant-cli` at §Step 1).

use clap::{ArgAction, CommandFactory, Parser, Subcommand};
use thiserror::Error;

/// Top-level CLI arguments. `clap::Parser` derives `Cli::parse()`
/// from `std::env::args()`; tests use `Cli::parse_from(&[...])`.
///
/// §Step 2: renamed from §Step 1's `Args` to `Cli` per FID-030 spec
/// §Subcommand Tree (line 191 of the FID doc).
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
    /// (FID-030 §Decisions Q6 — 3001 keeps Savant-specific 3xxx range.)
    #[arg(long, global = true, default_value = "3001")]
    pub gateway_port: u16,

    /// Port for the Next.js dashboard (default 3000; only used in dev mode).
    #[arg(long, global = true, default_value = "3000")]
    pub dashboard_port: u16,

    /// Skip opening the browser on startup (for headless servers / CI).
    /// (FID-030 §Decisions Q5 — open-by-default + `--no-browser` flag.)
    #[arg(long, global = true)]
    pub no_browser: bool,

    /// Custom config file path (TOML; `~/.config/savant/config.toml` by default).
    /// (FID-030 §Missed Questions Q1 — `--config` flag for per-project configs.)
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
/// §Step 2: full surface (Dev / Chat / Memory / Vault / Doctor).
#[derive(Debug, Subcommand)]
pub enum Command {
    /// Default — boot the full Savant runtime
    /// (in-process gateway + browser open). §Step 2: subcommand is
    /// acknowledged; full boot lands at §Step 4.
    ///
    /// `--watch` switches to dev mode (`next dev` hot reload);
    /// default mode (no `--watch`) is prod (gateway's `embedded-web`
    /// feature serves the static export).
    /// (FID-030 §Default Behavior; §Step 2 renames §Step 1's `Run` → `Dev`
    /// + adds `watch` boolean flag per spec.)
    Dev {
        /// Use `next dev` instead of static export (hot reload).
        #[arg(long, action = ArgAction::SetTrue)]
        watch: bool,
    },
    /// CLI REPL — read stdin, send to `/v1/chat/...`, print responses.
    /// §Step 2: stub; real implementation lands in FID-031 / Layer 3.
    Chat,
    /// Memory engine subcommands. §Step 2: stub at clap level; real
    /// handlers land at §Step 3, gateway calls at FID-031 / Layer 3 (FID-032).
    Memory {
        #[command(subcommand)]
        action: MemoryAction,
    },
    /// Vault subcommands. §Step 2: stub at clap level; real handlers
    /// at §Step 3. Per ECHO Law 12, `Show` NEVER returns raw key bytes
    /// — only redacted summaries.
    Vault {
        #[command(subcommand)]
        action: VaultAction,
    },
    /// Health checks (gateway reachability + dashboard readiness + port
    /// negotiation + memory engine init + vault file readable).
    /// §Step 2: stub; partial stub calls `GET /v1/health` at §Step 3+
    /// (full health-check surface lands at FID-031+).
    Doctor,
}

/// Memory subcommand enum.
/// (FID-030 spec §Subcommand Tree — Memory section, lines 207-220.)
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

/// Vault subcommand enum.
/// (FID-030 spec §Subcommand Tree — Vault section, lines 222-232.)
#[derive(Debug, Subcommand)]
pub enum VaultAction {
    /// List all profiles (gateway `/v1/vault/profiles`).
    List,
    /// Show a redacted profile summary
    /// (gateway `/v1/vault/profiles/<name>`; never key bytes — ECHO Law 12).
    Show {
        name: String,
    },
}

/// Typed CLI errors — `thiserror` per `coding-standards/rust.md`.
/// `exit_code()` provides stable exit-code mapping (each variant gets
/// a distinct code so CI scripts can branch on the failure mode).
#[derive(Debug, Error)]
pub enum SavantCliError {
    /// `savant_runtime` initialisation failed (wired in §Step 4).
    #[error("savant_runtime init: {0}")]
    RuntimeInit(String),

    /// Gateway boot failed (port collision, readiness timeout).
    #[error("gateway boot: {0}")]
    GatewayBoot(String),

    /// Dashboard orchestration failed (`next dev` spawn, browser open).
    #[error("dashboard orchestration: {0}")]
    Dashboard(String),

    /// Catch-all for unforeseen propagated errors.
    #[error("savant-cli error: {0}")]
    Other(String),
}

impl SavantCliError {
    /// Stable exit-code mapping (FID-030 §Verifier Pass convention).
    pub fn exit_code(&self) -> u8 {
        match self {
            SavantCliError::RuntimeInit(_) => 10,
            SavantCliError::GatewayBoot(_) => 11,
            SavantCliError::Dashboard(_) => 12,
            SavantCliError::Other(_) => 1,
        }
    }
}

/// savant-cli entry point.
/// §Step 2: dispatches by subcommand to `tracing::info!` acknowledgements
/// describing where the implementation lands (Dev→§Step 4, Chat→FID-031+,
/// Memory/Vault/Doctor→§Step 3 + FID-031+).
/// Full dispatch (`commands/{dev,chat,memory,vault,doctor}.rs` modules)
/// lands at §Step 3.
pub fn run() -> Result<(), SavantCliError> {
    let cli = Cli::parse();
    match cli.command {
        Some(Command::Dev { watch }) => {
            tracing::info!(
                target: "savant_cli",
                ?watch,
                "savant dev subcommand acknowledged \u{2014} full runtime boot lands in \u{a7}Step 4"
            );
            Ok(())
        }
        Some(Command::Chat) => {
            tracing::info!(
                target: "savant_cli",
                "savant chat subcommand acknowledged \u{2014} CLI REPL lands in FID-031+ (Layer 3)"
            );
            Ok(())
        }
        Some(Command::Memory { action }) => {
            tracing::info!(
                target: "savant_cli",
                ?action,
                "savant memory subcommand acknowledged \u{2014} gateway calls land in \u{a7}Step 4 / FID-031+ (Layer 3)"
            );
            Ok(())
        }
        Some(Command::Vault { action }) => {
            tracing::info!(
                target: "savant_cli",
                ?action,
                "savant vault subcommand acknowledged \u{2014} gateway calls land in \u{a7}Step 4 / FID-031+ (ECHO Law 12: never key bytes)"
            );
            Ok(())
        }
        Some(Command::Doctor) => {
            tracing::info!(
                target: "savant_cli",
                "savant doctor subcommand acknowledged \u{2014} partial GET /v1/health stub lands in \u{a7}Step 3+"
            );
            Ok(())
        }
        None => {
            // Bare `savant` invocation: print clap's auto-generated
            // help and exit 0. Lets CI checks like `--help` succeed
            // without registering an explicit help-subcommand path.
            let mut cmd = Cli::command();
            cmd.print_help()
                .map_err(|e| SavantCliError::Other(format!("clap print_help: {e}")))?;
            println!();
            Ok(())
        }
    }
}

/// Listing of currently-implemented subcommand names. Public so the
/// smoke test asserts the catalogue stays in sync as §Steps add
/// variants (or as FID-034's kernel traits expand the CLI surface).
/// §Step 2: full surface per FID-030 spec.
pub fn implemented_subcommands() -> &'static [&'static str] {
    &["dev", "chat", "memory", "vault", "doctor"]
}
