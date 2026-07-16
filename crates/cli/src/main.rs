//! `savant` binary entry point (FID-030 §Step 2).
//!
//! §Step 2: bin name is `savant` per FID-030 spec verbatim (§Subcommand
//! Tree example uses `#[command(name = "savant", ...)]` at line 191 of
//! the FID doc); §Step 1 used `savant-cli`. `savant_cli` (the lib /
//! crate name) is unchanged; the `[[bin]]` is renamed.
//!
//! Forwards to `savant_cli::run()` (single source of truth per
//! FID-029 §Step 9 pattern). The thin wrapper exists so `cargo run
//! --bin savant -- ...` boots without `savant_cli::run` having to
//! thread its own process-exit handling. On error, the underlying
//! `SavantCliError::exit_code()` maps the error variant to a stable
//! exit code (10 / 11 / 12 / 1 by §Verifier Pass convention).

use std::process::ExitCode;

fn main() -> ExitCode {
    match savant_cli::run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            // Stderr so CI logs always surface the failure mode even
            // when stdout is captured by tooling.
            eprintln!("error: {e}");
            ExitCode::from(e.exit_code())
        }
    }
}
