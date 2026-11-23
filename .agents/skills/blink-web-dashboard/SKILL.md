---
name: blink-web-dashboard
description: Extend the Blink PWA dashboard, server status cards, monitor API client, or Samsung Stick IR remote. Use when editing web/src/**/*, blink-monitor/**, or adding a server/device card to this repository.
disable-model-invocation: true
---

# Blink Web Dashboard

## Quick context

- `web/` — React 19 + Vite 8 + Tailwind 4 + shadcn PWA.
- `blink-monitor/` — Rust workspace with `chat-agent` and `set-agent`.
- Both agents expose `GET /healthz` (public), `GET /status`, and `GET /history?range=1h` (Bearer auth).
- The remote posts `{ "cmd": "..." }` to `/api/stick/ir/commands` with a separate Bearer token.

## Commands

```bash
make install          # npm install for web
make dev              # Vite dev server on :5173
make check            # web lint + typecheck + cargo check
make build            # production web build + release Rust binaries
make monitor-fmt      # cargo fmt --all
```

## Conventions

- Add UI primitives with `npx shadcn@latest add <component> --cwd web --yes`; do not hand-roll shadcn components.
- Keep API DTOs in `web/src/lib/types.ts` and fetch functions in `web/src/lib/api.ts`.
- Settings live in `localStorage` under `blink.settings.v1`; never hardcode tokens.
- Dev proxies are defined in `web/vite.config.ts`: `/chat-api`, `/set-api`, `/stick-api`.
- Server cards use `useMonitor(server, settings)` from `web/src/hooks/use-monitor.ts`.
- Remote command names must match the Stick IR API exactly: `power`, `source`, `mute`, `prev`, `vol_up`, `vol_down`, `ch_up`, `ch_down`, and digits `0`–`9`.

## Adding a monitored server

1. Add its key to `ServerKey` in `web/src/lib/types.ts`.
2. Add a base URL field to `Settings` and `DEFAULT_SETTINGS` in `web/src/lib/api.ts`.
3. Add a dev proxy entry in `web/vite.config.ts` and a field in `SettingsDialog`.
4. Render another `ServerCard` in `web/src/App.tsx`.

## Verification

Always run `make check` and `npm run build --prefix web` before finishing. For Rust edits, also run `make monitor-lint`.
