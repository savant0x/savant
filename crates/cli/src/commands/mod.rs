//! `savant_cli::commands` -- subcommand dispatcher skeleton (FID-030
//! §Step 3).
//!
//! Per FID-030 spec §Detailed Description §Step 3 + §Impact
//! Assessment §File Structure:
//!
//! > `crates/cli/src/commands/mod.rs` -- command module registry +
//! > dispatch
//!
//! The `dispatch(&Cli) -> Result<(), SavantCliError>` function routes
//! a parsed `Cli` to the matching per-subcommand handler module's
//! `handle() -> Result<(), SavantCliError>`. At §Step 3 only the
//! `dispatch` function exists; the per-subcommand handler modules
//! land at their respective §Steps (see the documentation block
//! below).
//!
//! ## Per-subcommand handler land-points (FID-030 strict sequence)
//!
//! - `dev`: lands at FID-030 §Step 4 (in-process gateway boot + dev-mode `next dev` spawn + browser orchestration + signal handling). Signature: `commands::dev::handle(cli: &Cli) -> Result<(), SavantCliError>`.
//! - `chat`: lands at FID-030 §Step 11 (CLI REPL stub "Not yet implemented -- coming in FID-031"; real impl at FID-031+ / Layer 3).
//! - `memory`: lands at FID-030 §Step 11 (search + list stubs calling gateway /v1/memory/search + /v1/memory/sessions; full impl at FID-031+ / Layer 3).
//! - `vault`: lands at FID-030 §Step 11 (list + show stubs calling gateway /v1/vault/profiles + /v1/vault/profiles/<name>; ECHO Law 12: never key bytes; full impl at FID-031+ / Layer 3).
//! - `doctor`: lands at FID-030 §Step 11 (partial stub calling GET /v1/health; full health checks at FID-031+ / Layer 3).
//!
//! Until each handler lands, this dispatcher's matching arm is a
//! stub branch that returns `Ok(())` and logs a `tracing::info!`
//! describing which §Step will own the real implementation. The
//! return type `Result<(), SavantCliError>` is preserved end-to-end
//! so when the real handlers (with their own failure modes -- e.g.,
//! `commands::dev::handle` returning `Err(SavantCliError::RuntimeInit(_))`
//! at §Step 4 when `savant_runtime::Runtime::new(&config)` fails) land,
//! the failure propagates correctly through `dispatch` to `run()` and
//! out through the `SavantCliError::exit_code()` mapping.

use crate::cli::{Cli, Command as RootCommand};
use crate::SavantCliError;
use clap::CommandFactory;

/// Dispatch a `Cli` to the matching subcommand handler.
///
/// §Step 3: each non-`None` arm is a stub that acks via
/// `tracing::info!` + returns `Ok(())`. The `None` arm prints
/// clap's auto-generated help and exits 0.
///
/// §Step 4+ will replace each stub arm with a call into the
/// matching `commands::{dev,chat,memory,vault,doctor}::handle`
/// function. The dispatch refactor at §Step 3 (no `run()`-time
/// `match`) is the foundation future §Steps build on.
pub fn dispatch(cli: &Cli) -> Result<(), SavantCliError> {
    match &cli.command {
        Some(RootCommand::Dev { watch }) => {
            // §Step 4 lands `commands::dev::handle(cli)` here.
            tracing::info!(
                target: "savant_cli::commands",
                ?watch,
                "dev dispatch stub -- §Step 4 will land commands::dev::handle (in-process gateway boot + dev-mode next dev spawn + browser orchestration + signal handling)"
            );
            Ok(())
        }
        Some(RootCommand::Chat) => {
            // §Step 11 lands `commands::chat::handle(cli)` here
            // (stub: "Not yet implemented -- coming in FID-031").
            tracing::info!(
                target: "savant_cli::commands",
                "chat dispatch stub -- §Step 11 will land commands::chat::handle stub (\"Not yet implemented -- coming in FID-031\")"
            );
            Ok(())
        }
        Some(RootCommand::Memory { action }) => {
            // §Step 11 lands `commands::memory::handle(cli, action)` here.
            tracing::info!(
                target: "savant_cli::commands",
                ?action,
                "memory dispatch stub -- §Step 11 will land commands::memory::handle stub (gateway /v1/memory/search + /v1/memory/sessions)"
            );
            Ok(())
        }
        Some(RootCommand::Vault { action }) => {
            // §Step 11 lands `commands::vault::handle(cli, action)` here.
            tracing::info!(
                target: "savant_cli::commands",
                ?action,
                "vault dispatch stub -- §Step 11 will land commands::vault::handle stub (gateway /v1/vault/profiles + /v1/vault/profiles/<name> -- ECHO Law 12: never key bytes)"
            );
            Ok(())
        }
        Some(RootCommand::Doctor) => {
            // §Step 11 lands `commands::doctor::handle(cli)` here.
            tracing::info!(
                target: "savant_cli::commands",
                "doctor dispatch stub -- §Step 11 will land commands::doctor::handle stub (partial: GET /v1/health)"
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
