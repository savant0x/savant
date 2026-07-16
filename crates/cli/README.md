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
- §Step 4 — runtime boot path (in-process `savant_gateway::server::start_gateway(state, port)`)
- §Step 5 — signal handling (`tokio::signal::ctrl_c` + graceful shutdown)
- §Step 6 — dev-mode `next dev` spawn
- §Step 7 — browser orchestration (`webbrowser::open`)
- §Steps 8-15 — prod-mode serving, port negotiation, `--api-only`, cancellation, cross-platform smoke
- §Step 16 — Verifier Pass ratification

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

## Exit-code Stability (FID-030 §Verifier Pass convention)

| `SavantCliError` variant | Exit code | Trigger |
|---|---|---|
| `RuntimeInit` | 10 | `savant_runtime` init failure (wired at §Step 4) |
| `GatewayBoot` | 11 | Gateway port collision / readiness timeout |
| `Dashboard` | 12 | `next dev` spawn failure or browser open failure |
| `Other` | 1 | Catch-all federated error |

## Canonical Specs

- **Layer 2 spec:** [`dev/fids/FID-2026-07-14-030-cli-scaffold.md`](../../dev/fids/FID-2026-07-14-030-cli-scaffold.md)
- **Master layered build order:** [`dev/fids/FID-2026-07-14-035-master-strangler-fig-impl-order.md`](../../dev/fids/FID-2026-07-14-035-master-strangler-fig-impl-order.md)
- **ECHO Protocol:** [`ECHO.md`](../../ECHO.md)
- **Release workflow:** [`coding-standards/release-workflow.md`](../../coding-standards/release-workflow.md)
