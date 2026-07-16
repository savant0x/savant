# savant-cli

Savant CLI runtime host — Layer 2 of master FID-035 Strangler-Fig Tauri → CLI
architecture migration. Per FID-030 spec verbatim: **the CLI is the runtime
host** that imports `savant_gateway` + `savant_runtime` directly (ZeroClaw
pattern). The dashboard is a renderer (separate `next dev` in dev mode OR
static export served by the gateway's `embedded-web` feature in prod).

This is the empty bootstrap scaffold at §Step 1, with the §Step 2 clap
expansion layered on top: full subcommand tree + global flag groups + nested
`MemoryAction` / `VaultAction` enums. Subsequent §Steps wire the actual
runtime + dashboard orchestration:
- §Step 3 — subcommand handler modules (`commands/{dev,chat,memory,vault,doctor}.rs`)
- §Step 4 — runtime host helpers (port + signal + browser + process); spec §Steps 7-10 reordered here per LESSON-038 (helpers must compile before the orchestrator that consumes them). The actual runtime boot orchestrator (`commands::dev::handle` invoking `savant_gateway::server::start_gateway`) lands at §Step 5.
- §Step 5 — `commands/dev.rs` orchestrator (gateway in-process + dashboard child + signal handling + browser open)
- §Steps 6-16 — prod-mode serving, port negotiation, `--api-only`, cancellation, cross-platform smoke, Verifier Pass ratification

## §Step 2 Subcommand Tree

```sh
# Default — boot the full Savant runtime
savant                                       # bare invocation: prints help, exits 0
savant dev                                   # default subcommand (prod-mode gateway + browser open)
savant dev --watch                           # dev-mode with `next dev` hot reload

# REPL + subcommands (stubs at §Step 2; full impl lands in §Step 3 + FID-031+)
savant chat                                  # CLI REPL (FID-031+)
savant memory search <query> [--limit N]     # gateway /v1/memory/search (default limit 10)
savant memory list                           # gateway /v1/memory/sessions
savant vault list                            # gateway /v1/vault/profiles
savant vault show <name>                     # gateway /v1/vault/profiles/<name> (redacted; ECHO Law 12)
savant doctor                                # health checks (gateway reachable, port OK, memory engine init, vault readable)

# Global flags (apply to any subcommand)
savant --gateway-port 3001 ...               # default 3001 (FID-030 §Decisions Q6)
savant --dashboard-port 3000 ...             # default 3000 (only used in dev mode)
savant --no-browser ...                      # skip browser open (CI / headless)
savant --config /path/to/config.toml ...     # custom TOML config (FID-030 §Missed Questions Q1)
savant --log-level debug ...                 # alt to -v counting (FID-030 §Missed Questions Q7 / §Suggestions G)
savant -v / -vv / -vvv ...                   # short-form tracing-subscriber verbosity counter
savant --verbose ...                   # long form; counts per occurrence (clap `ArgAction::Count`)
```

## §Step 3 Module Structure (module split per FID-030 spec §Step 3)

```text
crates/cli/src/
├── lib.rs                  # entry: SavantCliError + exit_code() + run() +
│                           #   `pub mod cli;` + `pub mod commands;` +
│                           #   `pub use cli::{Cli, Command, MemoryAction, VaultAction};`
├── cli.rs                  # clap definitions (Cli + Command + MemoryAction +
│                           #              VaultAction); §Step 2's lib.rs enums
│                           #              migrated here at §Step 3
├── commands/
│   └── mod.rs              # subcommand dispatcher (`commands::dispatch(&Cli)`);
│                           # per-subcommand handler modules
│                           # (`commands::{dev,chat,memory,vault,doctor}::handle`)
│                           # land at:
│                           #   · commands::dev::handle     — §Step 4
│                           #   · commands::chat::handle    — §Step 11 (stub)
│                           #   · commands::memory::handle  — §Step 11 (stub)
│                           #   · commands::vault::handle   — §Step 11 (stub)
│                           #   · commands::doctor::handle  — §Step 11 (stub)
└── main.rs                 # `fn main() → ExitCode` thin wrapper around
                            # `savant_cli::run()`
```

## §Step 4 Runtime Host Helpers (FID-030 spec §Steps 7-10, reordered per LESSON-038)

```text
crates/cli/src/runtime_helpers/
├── mod.rs                  # module registry; §Step 4 rationale + dep-minimality notes
├── port.rs                 # is_port_available(u16) -> bool  (tokio::net::TcpListener::bind)
│                           # negotiate_port(preferred) -> Result<u16, SavantCliError>
│                           # (+0..+9 fallback per FID-030 §Decisions Q7)
├── signal.rs               # wait_for_shutdown() -> Result<(), SavantCliError>
│                           # (wraps tokio::signal::ctrl_c() — async-native, no ctrlc::set_handler bridge)
├── browser.rs              # open_browser(url) -> Result<(), SavantCliError>
│                           # (wraps webbrowser::open — cross-platform ShellExecute/open/xdg-open)
└── process.rs              # spawn_npx(args) -> Result<Child, SavantCliError>  (kill_on_drop(true))
                            # wait_for_http(host, port, timeout) -> Result<(), SavantCliError>  (TCP probe, no reqwest dep)
                            # kill_process_tree(child) -> Result<(), SavantCliError>  (tokio Child::kill — best-effort, orphan-grandchild caveat documented)
```

### §Step 4 Reordering Rationale

The FID-030 spec places `commands/dev.rs` (§Step 5) BEFORE these helpers (§Steps 7-10). Per LESSON-038 (no-unilateral-defer) + LESSON-062 (path discipline), helpers must compile before the orchestrator that consumes them. So:

- **§Step 4 (this commit)**: the 4 helpers + `pub mod runtime_helpers` + 4 new `SavantCliError` variants + workspace `webbrowser = "0.8"` + crate-level `tokio` + `webbrowser`. The `commands/dev.rs` orchestrator remains a stub (per spec §Step 3 dispatcher skeleton).
- **§Step 5 (next commit)**: `commands/dev.rs` orchestrator — composes the 4 helpers + calls `savant_gateway::server::start_gateway` in-process + spawns `next dev` in dev mode + opens browser + installs signal handler + blocks.

### Dep Minimality (per LESSON-038)

| Dep | Status | Why |
|---|---|---|
| `tokio` (workspace) | Already present | `features = ["full"]` covers `process`, `net`, `signal` (incl `tokio::signal::ctrl_c`) |
| `webbrowser = "0.8"` | NEW (workspace + crate) | Cross-platform default-browser launch; no existing alternative |
| `ctrlc = "3.4"` (spec) | **NOT added** to CLI crate | We use `tokio::signal::ctrl_c()` instead (async-native, no oneshot bridge needed). The workspace `ctrlc` stays for other consumers. |
| `nix = "0.27"` (spec) | **NOT added** | We use `tokio::process::Child::kill()` (portable). Process-group orphan grandchild caveat documented in `process::kill_process_tree` doc-comment. |

### Exit-code Stability (FID-030 §Verifier Pass convention)

| `SavantCliError` variant | Exit code | Trigger |
|---|---|---|
| `RuntimeInit` | 10 | `savant_runtime` init failure (wired at §Step 5) |
| `GatewayBoot` | 11 | Gateway port collision / readiness timeout |
| `Dashboard` | 12 | `next dev` spawn failure or browser open failure |
| `Port` | 13 | `negotiate_port` +0..+9 fallback all bound (spec §Step 8) |
| `Signal` | 14 | `tokio::signal::ctrl_c()` error (spec §Step 9) |
| `Spawn` | 15 | `spawn_npx` / `kill_process_tree` / `wait_for_http` error (spec §Step 7) |
| `Browser` | 1 | `webbrowser::open` failure — non-fatal UX failure; caller logs + prints URL |
| `Other` | 1 | Catch-all federated error |

## Canonical Specs

- **Layer 2 spec:** [`dev/fids/FID-2026-07-14-030-cli-scaffold.md`](../../dev/fids/FID-2026-07-14-030-cli-scaffold.md)
- **Master layered build order:** [`dev/fids/FID-2026-07-14-035-master-strangler-fig-impl-order.md`](../../dev/fids/FID-2026-07-14-035-master-strangler-fig-impl-order.md)
- **ECHO Protocol:** [`ECHO.md`](../../ECHO.md)
- **Release workflow:** [`coding-standards/release-workflow.md`](../../coding-standards/release-workflow.md)
