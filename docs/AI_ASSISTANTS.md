# AI assistants

This repository is set up for Codex, Claude Code, Cursor, and other agents that read project instructions from disk.

## Instruction files

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Primary repository instructions and verification rules |
| `CLAUDE.md` | Short pointer to `AGENTS.md` for Claude Code |
| `.cursor/rules/project.mdc` | Always-applied general rules |
| `.cursor/rules/web-react.mdc` | Rules for `web/src/**/*.{ts,tsx}` |
| `.cursor/rules/rust-monitor.mdc` | Rules for `blink-monitor/**/*.rs` |

## Skills

Skills are stored in `.cursor/skills/` and mirrored in `.agents/skills/`.

- `blink-web-dashboard` — extend the PWA, server cards, API client, or remote.
- `rust-best-practices` — vendored from the iOS Blink project; applies to `blink-monitor/`.

Attribution for vendored skills is in `.cursor/skills/ATTRIBUTION.md`.

## Suggested workflow

1. Read `AGENTS.md` and the relevant rule file.
2. Load the matching skill when working in `web/` or `blink-monitor/`.
3. Make the change.
4. Run `make check`.
5. Run `npm run build --prefix web` for web changes.
6. Run `make monitor-lint` for Rust changes.

## Adding a skill

Create `.cursor/skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`, optional `disable-model-invocation: true`), then copy it to `.agents/skills/<name>/SKILL.md` to keep both locations in sync.
