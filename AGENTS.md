# AGENTS.md

Instructions for AI assistants working in this repository.

## Repository map

- `web/` — React 19 + Vite 8 + Tailwind 4 + shadcn installable PWA dashboard.
- `blink-monitor/` — Rust workspace: `chat-agent` and `set-agent` HTTP monitors.
- `docs/` — architecture, development, API, deployment, and assistant notes.
- `ecosystem.config.cjs` — PM2 config that serves `web/dist` on `127.0.0.1:8787`.
- `.cursor/rules/` and `.cursor/skills/` (mirrored in `.agents/`) — editor/agent guidance.
- `Makefile` — canonical shortcuts for install, dev, build, lint, deploy, and monitor tasks.

## Golden rules

1. Run `make check` after any change. Run `npm run build --prefix web` before finishing web work.
2. Use `npx shadcn@latest add <component> --cwd web --yes` for new UI primitives.
3. Never commit tokens, `.env` files, SQLite databases, or `target/` output.
4. Keep browser-side API shapes in `web/src/lib/types.ts` aligned with Rust DTOs in `blink-monitor/crates/shared/src/models.rs`.
5. Treat `blink-monitor` as production code: format with `cargo fmt`, validate with `cargo clippy -- -D warnings`.
6. Preserve the Stick IR command strings exactly (`vol_up`, `ch_down`, digits, etc.).
7. Never write plaintext dashboard credentials into source or docs. Regenerate the static PBKDF2 block with `BLINK_USERNAME=... BLINK_PASSWORD=... make auth-hash`.

## Common commands

```bash
make help              # list all shortcuts
make install           # install web dependencies
make dev               # start Vite at http://localhost:5173
make check             # web lint + typecheck + cargo check
make build             # web production build + release Rust binaries
make monitor-fmt       # format Rust
make monitor-lint      # clippy with warnings denied
make monitor-test      # Rust tests
make pm2-start         # build PWA and serve it via PM2 on 127.0.0.1:8787
```

## Production ports

| Service | Bind |
| --- | --- |
| PWA via PM2 (`blink-web`) | `127.0.0.1:8787` |
| `chat-agent` | `127.0.0.1:8790` |
| `set-agent` | `127.0.0.1:8788` |
| Stick IR API | `127.0.0.1:3020` |
| nginx | public `:80` / `:443` |

Do not expose the loopback ports publicly; terminate TLS in nginx.

## API contract

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /healthz` | none | liveness |
| `GET /status` | `Authorization: Bearer <BLINK_API_KEY>` | latest CPU/RAM/disk/services snapshot |
| `GET /history?range=1h` | same Bearer token | last hour of samples |
| `POST /api/stick/ir/commands` | separate Stick IR Bearer token | enqueue one IR command (latest wins) |

Default agent ports: `chat-agent` `127.0.0.1:8790`, `set-agent` `127.0.0.1:8788`. Do not expose them publicly; terminate TLS in a reverse proxy.

## Web notes

- Settings are stored in `localStorage` (`blink.settings.v1`) and never bundled into the app.
- Vite dev proxies: `/chat-api` → `chat.mm2d.xyz/blink`, `/set-api` → `api.mm2d.xyz/blink`, `/stick-api` → `chat.mm2d.xyz/api/stick/ir`.
- Production deployments should serve the PWA from the same origin as the reverse proxy, or add CORS headers to the agent endpoints.
- `ecosystem.config.cjs` serves `web/dist` via PM2 on `127.0.0.1:8787`; nginx proxies the public domain to it and to the agents.
- PWA assets are generated from `web/public/logo.svg` with `make pwa-assets`.

## Detailed docs

See `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/API.md`, `docs/DEPLOYMENT.md`, and `docs/AI_ASSISTANTS.md`.
