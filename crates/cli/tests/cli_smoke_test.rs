//! FID-030 §Step 3 smoke tests -- verify the multi-subcommand clap tree +
//! global flag groups + error exit-code mapping per FID-030 spec verbatim,
//! plus the §Step 3 dispatcher skeleton (commands::dispatch) + lib.rs
//! re-exports.
//!
//! §Step 2 expansions over §Step 1:
//!   - `Args` -> `Cli` (test invocations + assertions)
//!   - `Command::Run` -> `Command::Dev { watch: bool }` (default subcommand)
//!   - `Memory { action: MemoryAction::{Search {query,limit}, List} }`
//!   - `Vault  { action: VaultAction::{List, Show {name}} }`
//!   - Global flags: `--gateway-port`, `--dashboard-port`, `--config`,
//!     `--no-browser`, `-v`/`--verbose`
//!
//! §Step 3 additions:
//!   - commands::dispatch(&Cli) returns Ok(()) for each stub branch
//!   - Full argparse -> dispatch flow integration
//!   - lib.rs re-exports point at canonical cli.rs types (type-name identity)
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
    // Locks in that --verbose (long form) parses identically to -v (short form).
    assert_eq!(
        Cli::parse_from(["savant", "--verbose", "--verbose", "--verbose", "doctor"]).verbose,
        3
    );
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
    let result = Cli::try_parse_from(["savant", "definitely-not-a-real-subcommand"]);
    assert!(
        result.is_err(),
        "expected clap error for unknown subcommand"
    );
}

#[test]
fn test_savant_cli_error_exit_code_stable_mapping() {
    // Stable mapping per FID-030 verifier-pass convention: distinct
    // exit codes per variant so CI scripts can branch on failure mode.
    // §Step 4 extended: Port=13, Signal=14, Spawn=15; Browser falls back to 1
    // (best-effort UX failure, same as Other).
    assert_eq!(SavantCliError::RuntimeInit("x".into()).exit_code(), 10);
    assert_eq!(SavantCliError::GatewayBoot("x".into()).exit_code(), 11);
    assert_eq!(SavantCliError::Dashboard("x".into()).exit_code(), 12);
    assert_eq!(SavantCliError::Port("x".into()).exit_code(), 13);
    assert_eq!(SavantCliError::Signal("x".into()).exit_code(), 14);
    assert_eq!(SavantCliError::Spawn("x".into()).exit_code(), 15);
    assert_eq!(SavantCliError::Browser("x".into()).exit_code(), 1);
    assert_eq!(SavantCliError::Other("x".into()).exit_code(), 1);
}

// ── §Step 3 dispatcher tests (lib.rs / cli.rs / commands/ module split) ──

#[test]
fn test_commands_dispatch_dev_subcommand_returns_ok() {
    use savant_cli::commands;
    let cli = Cli::parse_from(["savant", "dev", "--watch"]);
    // §Step 3 stub branch -- replaces commands::dev::handle(cli) at §Step 4.
    assert!(commands::dispatch(&cli).is_ok());
}

#[test]
fn test_commands_dispatch_full_argparse_flow_for_doctor() {
    use savant_cli::commands;
    let cli = Cli::parse_from(["savant", "doctor"]);
    // End-to-end: parse -> dispatch returns Ok(()) via the
    // §Step 3 stub branch (commands::doctor::handle lands at §Step 11).
    assert!(commands::dispatch(&cli).is_ok());
}

#[test]
fn test_commands_dispatch_full_argparse_flow_for_memory_search() {
    use savant_cli::commands;
    let cli = Cli::parse_from(["savant", "memory", "search", "u", "--limit", "3"]);
    // Executing the Memory sub-action enum path through dispatch verifies
    // §Step 3 nested MemoryAction re-exports + command-enum routing.
    assert!(commands::dispatch(&cli).is_ok());
}

#[test]
fn test_commands_dispatch_full_argparse_flow_for_vault_list() {
    // Symmetric coverage to test_commands_dispatch_full_argparse_flow_for_memory_search
    // (§Step 3 code-reviewer nit #2): exercises Vault::List through dispatch.
    use savant_cli::commands;
    let cli = Cli::parse_from(["savant", "vault", "list"]);
    assert!(commands::dispatch(&cli).is_ok());
}

#[test]
fn test_commands_dispatch_full_argparse_flow_for_vault_show() {
    // Symmetric coverage for Vault::Show path (parser-tested above but
    // never reached dispatch). The dispatcher's stub branch will be
    // replaced by commands::vault::handle at §Step 11; the test pins the
    // §Step 3 transition contract.
    use savant_cli::commands;
    let cli = Cli::parse_from(["savant", "vault", "show", "openrouter"]);
    assert!(commands::dispatch(&cli).is_ok());
}

#[test]
fn test_cli_types_re_exported_from_lib_root() {
    // §Step 3: lib.rs re-exports the enums from cli.rs so callers can
    // keep writing savant_cli::Cli / savant_cli::Command /
    // savant_cli::MemoryAction / savant_cli::VaultAction. The type
    // identities must resolve through the re-exports (i.e., the
    // re-export path points at the canonical cli.rs type).
    use savant_cli::{
        Cli as LibCli, Command as LibCommand,
        MemoryAction as LibMem, VaultAction as LibVault,
    };
    use savant_cli::cli::{
        Cli as ModCli, Command as ModCommand,
        MemoryAction as ModMem, VaultAction as ModVault,
    };
    assert_eq!(
        std::any::type_name::<LibCli>(),
        std::any::type_name::<ModCli>(),
    );
    assert_eq!(
        std::any::type_name::<LibCommand>(),
        std::any::type_name::<ModCommand>(),
    );
    assert_eq!(
        std::any::type_name::<LibMem>(),
        std::any::type_name::<ModMem>(),
    );
    assert_eq!(
        std::any::type_name::<LibVault>(),
        std::any::type_name::<ModVault>(),
    );
}
