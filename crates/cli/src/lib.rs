//! `savant_cli` — Savant CLI runtime host (FID-030 §Step 1).
//!
//! Layer 2 of master FID-035 §Layered Build Order. Per the ZeroClaw
//! architecture, the CLI binary is the runtime host: it parses the
//! command line via clap, in-process initialises the gateway, spawns
//! `next dev` for the dashboard in dev mode, and serves embedded web
//! assets in prod mode. §Step 1 is the **binary scaffold only** —
//! the `run` subcommand is acknowledged with a tracing log; the
//! actual subcommand handlers (chat / memory / vault / doctor etc.)
//! land in subsequent §Steps.

use clap::{CommandFactory, Parser, Subcommand};
use thiserror::Error;

/// Top-level CLI arguments. `clap::Parser` derives `Args::parse()`
/// from `std::env::args()`; tests use `Args::parse_from(&[...])`.
#[derive(Debug, Parser)]
#[command(
    name = "savant-cli",
    version,
    about = "Savant runtime host (FID-030 Layer 2 Strangler-Fig migration — ZeroClaw pattern)"
)]
pub struct Args {
    /// Subcommand to execute. Bare `savant-cli` (no subcommand) prints
    /// clap's auto-generated help and exits 0.
    #[command(subcommand)]
    pub command: Option<Command>,
}

/// Subcommand enum. Only `Run` is wired at §Step 1 — the eventual
/// surface is documented in `dev/fids/FID-2026-07-14-030-cli-scaffold.md`
/// (chat / memory / vault / doctor / dev etc. land in §Steps 6+).
#[derive(Debug, Subcommand)]
pub enum Command {
    /// Boot the full Savant runtime (gateway + dashboard). §Step 1:
    /// subcommand is acknowledged; full boot lands in §Step 4.
    Run,
}

/// Typed CLI errors — `thiserror` per `coding-standards/rust.md`.
/// `exit_code()` provides stable exit-code mapping (each variant gets
/// a distinct code so CI scripts can branch on the failure mode).
#[derive(Debug, Error)]
pub enum SavantCliError {
    /// `savant_runtime` initialisation failed (wired in §Step 2+).
    #[error("savant_runtime init: {0}")]
    RuntimeInit(String),

    /// Gateway boot failed (port already in use, readiness timeout).
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

/// savant-cli entry point. Full dispatch logic lands in subsequent
/// §Steps; §Step 1 only verifies that (a) the binary scaffold
/// compiles, (b) the `Args::parse()` contract works, and (c) the
/// `Run` subcommand routes through `run()` returning `Ok(())`.
pub fn run() -> Result<(), SavantCliError> {
    let args = Args::parse();
    match args.command {
        Some(Command::Run) => {
            // §Step 4 wires the actual runtime boot + dashboard spawn.
            tracing::info!(
                target: "savant_cli",
                "savant-cli run subcommand acknowledged — full runtime boot lands in §Step 4"
            );
            Ok(())
        }
        None => {
            // Bare `savant-cli` invocation: print clap's auto-generated
            // help and exit 0. Lets CI checks like `--help` succeed
            // without registering an explicit help-subcommand path.
            let mut cmd = Args::command();
            cmd.print_help()
                .map_err(|e| SavantCliError::Other(format!("clap print_help: {e}")))?;
            println!();
            Ok(())
        }
    }
}

/// Listing of currently-implemented subcommand names. Public so the
/// smoke test asserts the catalogue stays in sync as §Steps add
/// additional variants.
pub fn implemented_subcommands() -> &'static [&'static str] {
    &["run"]
}
