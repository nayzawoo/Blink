# Blink

Blink is a PWA dashboard for monitoring IoT/backend servers and controlling a Samsung TV through the Stick IR API. It pairs a React web client with the Rust `blink-monitor` agents moved from the iOS Blink project.

## Features

- Live status for `chat-agent` and `set-agent`: CPU, per-core load, RAM, disk, services, and top processes.
- 60-second sparkline plus 1-hour CPU/RAM/disk history.
- Samsung TV remote backed by the Stick IR single-slot command API (latest press wins).
- Optional Payoneer/Wise exchange-rate card.
- Installable PWA with offline app shell, manifest, and generated icons.
- Browser-local settings for API keys and endpoint overrides — no secrets in the bundle.
- Rust workspace with Slack alerts and SQLite history for both agents.

## Repository layout

```text
.
├── web/                 # React 19 + Vite 8 + Tailwind 4 + shadcn PWA
│   ├── public/          # logo and generated PWA icons
│   └── src/             # app, components, hooks, API client
├── blink-monitor/       # Rust workspace (chat-agent, set-agent, shared)
├── docs/                # architecture, development, API, deployment, AI
├── .cursor/             # rules and skills (mirrored in .agents/)
├── .agents/             # mirrored skills
├── AGENTS.md            # instructions for AI assistants
├── CLAUDE.md
└── Makefile             # canonical shortcuts
```

## Quick start

Requirements: Node.js 20.19+, npm 11+, Rust/Cargo 1.85+ (2024 edition).

```bash
make install
make dev
```

Open <http://localhost:5173>, click **Settings**, and enter:

- `BLINK_API_KEY` — must match the key configured on the agents.
- Stick IR token — only needed for the TV remote.
- Base URLs — defaults use the Vite dev proxy and work out of the box.

Build and verify everything:

```bash
make check
make build
```

## Monitor agents

```bash
make setup-env         # creates blink-monitor/.env from the chat example
make monitor-run-chat  # http://127.0.0.1:8787
make monitor-run-set   # copy .env.set.example and set BIND_ADDR=127.0.0.1:8788
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for local agent setup and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for reverse-proxy/PWA deployment.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)
- [API](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [AI assistants](docs/AI_ASSISTANTS.md)
- [Monitor agent README](blink-monitor/README.md)
