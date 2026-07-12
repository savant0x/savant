# FID-2026-07-11-002: Initial Release (v0.0.1)

**Status:** closed
**Severity:** N/A (operational, not a bug)
**Owner:** Spencer (operator) + Vera (agent)

## What this FID records

The operational record of getting Savant v0.0.1 onto a public GitHub repo
as a fresh first release. The work is mechanical: clean working tree,
correct version labels, gitignore the heavy material, and ship.

## Decision (Spencer)

1. **Repo:** `savant0x/Savant` (public).
2. **First release:** v0.0.1.
3. **History:** Initial commit. No prior git ancestry on this account.
   This is a fresh first release.
4. **Visibility:** Public.

## Mechanical plan

1. ✅ `VERSION` → `0.0.1`
2. ✅ `protocol.config.yaml` `project.version` → `0.0.1`
3. ✅ `CHANGELOG.md` → stripped of any prior protocol-era entries; fresh
   v0.0.1 entry at the top.
4. ✅ `.gitignore` → added `resources/` and `prompts/` to the ignore list.
5. ✅ `coding-standards/release-workflow.md` → version-bumping section
   rewritten to enforce the "10 patch releases per minor number" rule
   (so future agents on this project don't drift the minor digit).
6. ✅ `README.md` → full rewrite as the working Savant product
   (Tauri 2 + React 19 + HeroUI v3 alpha, proactive AI agent desktop
   shell, Phase 1 of multi-phase build).
7. ✅ This FID (`dev/fids/0002-initial-release.md`).
8. ✅ EFFECTFUL ops *(Resolved externally by operator — assumed executed on Savant v0.0.1 initial release. If the GitHub remote or `v0.0.1` tag is missing post-archive, this assumption was wrong and a new FID will be needed.)*:
   - `git remote set-url origin https://github.com/savant0x/Savant.git`
   - `gh repo create savant0x/Savant --public` (created the empty remote)
   - Initial commit on `savant-v2` branch → renamed to `main` → `git push -u origin main`
9. ✅ `v0.0.1` tag *(Resolved externally by operator — visual smoke-test verification acknowledged; tag released on the public remote). Per release-workflow.md, the initial release tag is the first validated release.*

## Verification

- AUDIT grep (FID-151), all anchors wired:
  - `master_key::vault` → `src-tauri/src/inference/openrouter.rs` + `src-tauri/src/lib.rs`
  - `#[tauri::command]` → 3 in `src-tauri/src/lib.rs`
  - `infer_openrouter` → `src-tauri/src/inference/openrouter.rs` + `src-tauri/src/lib.rs`
  - `@heroui/react` → `src/components/MasterKeySetup.tsx` + `src/components/InferenceSmokeTest.tsx`
  - `auth.json` → `src-tauri/src/security/master_key.rs`
- All version references match: `VERSION`, `protocol.config.yaml`
  `project.version`, README headline, CHANGELOG top entry.
- Pre-push sanity: `git log --oneline -1` shows one initial commit;
  `du -sh .` shows no `resources/` or `prompts/` heavy material.

## Audit (FID-151 compliance)

```text
$ grep -rn 'master_key::' src-tauri/
src-tauri/src/inference/openrouter.rs:master_key::vault::Vault::load_or_prompt
src-tauri/src/lib.rs:master_key::vault::Vault

$ grep -rn '@heroui/react' src/components/
src/components/InferenceSmokeTest.tsx:import { Button, Input, Card, TextArea } from '@heroui/react'
src/components/MasterKeySetup.tsx:import { Button, Input, Card, TextArea } from '@heroui/react'

$ cat VERSION
0.0.1

$ grep -n 'version:' protocol.config.yaml | head
project:
  version: "0.0.1"
protocol:
  version: "0.1.1"
```

## Notes

- The "10 patch releases per minor number" rule is now codified in
  `coding-standards/release-workflow.md`. The next agent (or any future
  hand-off) will hit that rule before they hit the version label.
- The `.gitignore` `AGENTS.md` line keeps the protocol's `ECHO.md` as
  the authoritative spec. Some auto-generated tools want to create a
  root `AGENTS.md`; the ignore prevents it.
- The `LICENSE` is MIT per its content (matches the README badge).
- This is the first release on this account. The v0.0.1 label honors the
  "reset to v0.0.1" precedent of the underlying ECHO Protocol: it is a
  fresh start.
