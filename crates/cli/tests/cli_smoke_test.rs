//! FID-030 §Step 2 smoke tests \u2014 verify the multi-subcommand clap tree +
//! global flag groups + error exit-code mapping per FID-030 spec verbatim.
//!
//! §Step 2 expansions over §Step 1:
//!   - `Args` \u2192 `Cli` (test invocations + assertions)
//!   - `Command::Run` \u2192 `Command::Dev { watch: bool }` (default subcommand)
//!   - `Memory { action: MemoryAction::{Search {query,limit}, List} }` (\u00a7Subcommand Tree)
//!   - `Vault  { action: VaultAction::{List, Show {name}} }` (\u00a7Subcommand Tree)
//!   - Global flags: `--gateway-port`, `--dashboard-port`, `--config`
//!
//! §Step 13 will expand further (port negotiator + signal handler tests).
//! §Verifier Pass gates: `cargo test -p savant_cli` exits 0 + all tests PASS.

use clap::Parser;
use savant_cli::{implemented_subcommands, Cli, Command, MemoryAction, SavantCliError, VaultAction};

// ── Top-level parser tests ──────────────────────────────────────────────

#[test]
fn test_cli_parser_accepts_dev_subcommand() {
    let cli = Cli::parse_from(["savant", "dev"]);
    assert!(matches!(cli.command, Some(Command::Dev { watch: false })));
}

#[test]
fn test_cli_parser_accepts_dev_subcommand_with_watch_flag() {
    let cli = Cli::parse_from(["savant", "dev", "--watch"]);
    assert!(matches!(cli.command, Some(Command::Dev { watch: true })));
}

#[test]
fn test_cli_parser_accepts_chat_subcommand() {
    let cli = Cli::parse_from(["savant", "chat"]);
    assert!(matches!(cli.command, Some(Command::Chat)));
}

#[test]
fn test_cli_parser_accepts_memory_search_subcommand() {
    let cli = Cli::parse_from([
        "savant", "memory", "search", "hello", "--limit", "5",
    ]);
    match cli.command {
        Some(Command::Memory {
            action: MemoryAction::Search { query, limit },
        }) => {
            assert_eq!(query, "hello");
            assert_eq!(limit, 5);
        }
        other => panic!("expected memory search, got {other:?}"),
    }
}

#[test]
fn test_cli_parser_accepts_memory_list_subcommand() {
    let cli = Cli::parse_from(["savant", "memory", "list"]);
    match cli.command {
        Some(Command::Memory { action: MemoryAction::List }) => {}
        other => panic!("expected memory list, got {other:?}"),
    }
}

#[test]
fn test_cli_parser_accepts_vault_show_subcommand() {
    let cli = Cli::parse_from(["savant", "vault", "show", "openrouter"]);
    match cli.command {
        Some(Command::Vault {
            action: VaultAction::Show { name },
        }) => {
            assert_eq!(name, "openrouter");
        }
        other => panic!("expected vault show openrouter, got {other:?}"),
    }
}

#[test]
fn test_cli_parser_accepts_vault_list_subcommand() {
    let cli = Cli::parse_from(["savant", "vault", "list"]);
    match cli.command {
        Some(Command::Vault { action: VaultAction::List }) => {}
        other => panic!("expected vault list, got {other:?}"),
    }
}

#[test]
fn test_cli_parser_accepts_doctor_subcommand() {
    let cli = Cli::parse_from(["savant", "doctor"]);
    assert!(matches!(cli.command, Some(Command::Doctor)));
}

#[test]
fn test_cli_parser_accepts_no_subcommand_yields_none() {
    let cli = Cli::parse_from(["savant"]);
    assert!(cli.command.is_none());
}

// ── Global flag tests ──────────────────────────────────────────────────

#[test]
fn test_cli_parser_global_flag_gateway_port() {
    let cli = Cli::parse_from(["savant", "--gateway-port", "4000", "doctor"]);
    assert_eq!(cli.gateway_port, 4000);
}

#[test]
fn test_cli_parser_global_flag_dashboard_port() {
    let cli = Cli::parse_from(["savant", "--dashboard-port", "4001", "doctor"]);
    assert_eq!(cli.dashboard_port, 4001);
}

#[test]
fn test_cli_parser_global_flag_config_path() {
    let cli = Cli::parse_from([
        "savant", "--config", "/tmp/savant.toml", "doctor",
    ]);
    assert_eq!(cli.config, Some("/tmp/savant.toml".to_string()));
}

#[test]
fn test_cli_parser_global_flag_no_browser() {
    let cli = Cli::parse_from(["savant", "--no-browser", "doctor"]);
    assert!(cli.no_browser);
}

#[test]
fn test_cli_parser_global_flag_verbose_count() {
    let cli = Cli::parse_from(["savant", "-vvv", "doctor"]);
    assert_eq!(cli.verbose, 3);
}

#[test]
fn test_cli_parser_global_flag_verbose_long_form() {
    // Locks in that `--verbose` (long form) parses identically to `-v` (short form).
    // Code-reviewer important #1: added after the str_replace that added `short = 'v',
    // long = "verbose"` to the verbose arg in `crates/cli/src/lib.rs`.
    let cli = Cli::parse_from([
        "savant",
        "--verbose",
        "--verbose",
        "--verbose",
        "doctor",
    ]);
    assert_eq!(cli.verbose, 3);
}

// ── Catalogue + unknown subcommand + error tests ───────────────────────

#[test]
fn test_implemented_subcommands_catalogue_full_surface() {
    let subs = implemented_subcommands();
    for required in &["dev", "chat", "memory", "vault", "doctor"] {
        assert!(
            subs.contains(required),
            "expected '{required}' in implemented subcommand catalogue ({subs:?})"
        );
    }
}

#[test]
fn test_unknown_subcommand_fails_to_parse() {
    // clap rejects unknown subcommands at parse time \u2014 must bubble
    // up as Err so `cargo run --bin savant -- bogus` exits non-zero.
    let result = Cli::try_parse_from(["savant", "definitely-not-a-real-subcommand"]);
    assert!(
        result.is_err(),
        "expected clap error for unknown subcommand"
    );
}

#[test]
fn test_savant_cli_error_exit_code_stable_mapping() {
    // Stable mapping per FID-030 \u00a7Verifier Pass convention \u2014 distinct
    // exit codes per variant so CI scripts can branch on failure mode.
    assert_eq!(SavantCliError::RuntimeInit("x".into()).exit_code(), 10);
    assert_eq!(SavantCliError::GatewayBoot("x".into()).exit_code(), 11);
    assert_eq!(SavantCliError::Dashboard("x".into()).exit_code(), 12);
    assert_eq!(SavantCliError::Other("x".into()).exit_code(), 1);
}
