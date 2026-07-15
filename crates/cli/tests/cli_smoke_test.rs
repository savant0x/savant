//! FID-030 §Step 1 smoke test — verifies the binary scaffold's CLI
//! contract end-to-end. RED-first: this file pre-dates any
//! non-trivial `savant_cli::run` implementation. Once
//! `cargo test -p savant_cli` exits 0 the §Step 1 acceptance
//! criteria — (a) buildable (`cargo check`) and (g) wired
//! (call-graph reachability) — are met.

use clap::Parser;
use savant_cli::{implemented_subcommands, Args, Command, SavantCliError};

#[test]
fn test_args_parser_accepts_run_subcommand() {
    let args = Args::parse_from(["savant-cli", "run"]);
    assert!(matches!(args.command, Some(Command::Run)));
}

#[test]
fn test_args_parser_accepts_no_subcommand_yields_none() {
    let args = Args::parse_from(["savant-cli"]);
    assert!(args.command.is_none());
}

#[test]
fn test_implemented_subcommands_catalogue_includes_run() {
    let subs = implemented_subcommands();
    assert!(
        subs.contains(&"run"),
        "expected 'run' in implemented subcommand catalogue ({subs:?})"
    );
}

#[test]
fn test_unknown_subcommand_fails_to_parse() {
    // clap rejects unknown subcommands at parse time — must bubble
    // up as Err so `cargo run -p savant_cli -- bogus` exits non-zero.
    let result = Args::try_parse_from(["savant-cli", "definitely-not-a-real-subcommand"]);
    assert!(
        result.is_err(),
        "expected clap error for unknown subcommand"
    );
}

#[test]
fn test_savant_cli_error_exit_code_stable_mapping() {
    // Stable mapping per FID-030 §Verifier Pass convention — distinct
    // exit codes per variant so CI scripts can branch on failure mode.
    assert_eq!(SavantCliError::RuntimeInit("x".into()).exit_code(), 10);
    assert_eq!(SavantCliError::GatewayBoot("x".into()).exit_code(), 11);
    assert_eq!(SavantCliError::Dashboard("x".into()).exit_code(), 12);
    assert_eq!(SavantCliError::Other("x".into()).exit_code(), 1);
}
