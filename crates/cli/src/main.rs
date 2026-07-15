//! `savant-cli` binary entry point.
//!
//! Forwards to `savant_cli::run()` (single source of truth per
//! FID-029 §Step 9 pattern). The thin wrapper exists so
//! `cargo run -p savant_cli -- ...` boots without
//! `savant_cli::run` having to thread its own process-exit handling.
//! On error, the underlying `SavantCliError::exit_code()` maps the
//! error variant to a stable exit code (10 / 11 / 12 / 1 by §Verifier
//! Pass convention).

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
