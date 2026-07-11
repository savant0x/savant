# Release Workflow Standards

<!-- Load this for all projects — defines the mandatory release cycle -->

## Mandatory Release Cycle

Every time code is pushed:

1. **Update CHANGELOG.md** — add entries for all changes since last push
2. **Review README.md** — update test counts, version references, any stale data
3. **Commit docs** — `git add CHANGELOG.md README.md && git commit -m "docs: ..."`
4. **Push** — `git push`
5. **Create/update release** — tag + release notes on GitHub (or equivalent)

**Never push code without updating CHANGELOG + README first. Never skip the release.**

## CHANGELOG Format

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):

```markdown
## [VERSION] — YYYY-MM-DD

### Added
- New features

### Fixed
- Bug fixes

### Changed
- Modifications to existing behavior

### Removed
- Deprecated features
```

Group entries by FID when applicable. Include file references in parentheses.

## README Maintenance

On every release, verify:

- [ ] Version number matches Cargo.toml / package.json
- [ ] Test count matches `cargo test` output
- [ ] FID count matches `dev/fids/` directory
- [ ] All referenced features still exist
- [ ] No stale links or descriptions

## AGENTS.md

Each project should have an `AGENTS.md` at the root with:

- Project-specific release workflow (may override this standard)
- Build & test commands
- Protocol version reference
- Any project-specific conventions

## Version Bumping — "10 patch releases per minor number" rule

Savant versions count the patch digit 10 times before bumping the minor
digit. This prevents the minor digit from growing absurdly fast as features
land.

```text
v0.0.1 → v0.0.2 → ... → v0.0.10 → v0.1.0 → v0.1.1 → ... → v0.1.10 → v0.2.0 → ...
```

- **Patch** (v0.1.5 → v0.1.6): Bug fixes, small improvements, internal refactors.
- **Minor** (v0.1.10 → v0.2.0): New feature announcements, non-breaking changes. **Do not bump to v0.2.0 from v0.1.5** — count the patch to v0.1.10 first.
- **Major** (v0.x → v1.0.0): Breaking changes, major architecture shifts, protocol version upgrades. Reserved for stability milestones.

Update `VERSION` first, then propagate to `protocol.config.yaml`
`project.version`, `CHANGELOG.md` top entry, and any other version
reference (README badge, package.json keyword, Cargo.toml). All four
must match.
