# Architecture

## Components

```text
Browser (Blink PWA)
  ├── /status, /history  ──► reverse proxy ──► chat-agent :8790
  │                                        └─► set-agent  :8788
  └── /commands          ──► reverse proxy ──► stick-ir-api :3020
```

### Web app (`web/`)

- React 19 SPA built with Vite 8.
- Tailwind CSS 4 via `@tailwindcss/vite`, shadcn (Radix base, Nova preset), Lucide icons.
- `vite-plugin-pwa` generates a service worker and web app manifest; icons come from `public/logo.svg`.
- `useMonitor` polls both agents, keeps a rolling 60-second sample buffer, and loads 1-hour history once per minute.
- Settings are persisted in `localStorage` and passed explicitly to API functions; tokens are never compiled into the bundle.

### Monitor agents (`blink-monitor/`)

Rust workspace with three crates:

| Crate | Role |
| --- | --- |
| `shared` | Config parsing, `sysinfo` collection, SQLite storage, health checks, Slack alerts, HTTP handlers, bearer auth |
| `chat-agent` | Binary for the chat server; profile name `chatserver`, service `chat` |
| `set-agent` | Binary for the map server; profile name `mapserver`, service `set` |

Each agent:

1. Loads `.env` with `dotenvy`.
2. Opens SQLite at `DB_PATH` (WAL mode).
3. Samples CPU/memory/disk/processes and performs configured service checks every second.
4. Stores samples in `samples` and 1-minute rollups in `rollups`.
5. Serves `/healthz`, `/status`, and `/history` with Axum.

### Data flow

- `GET /status` returns the latest in-memory `StatusSnapshot`.
- `GET /history` returns up to one hour of raw samples from SQLite.
- The PWA converts status responses into gauges, core meters, service badges, and sparkline points.
- IR commands are unrelated to the monitor agents; they go directly to the separate `stick-ir-api`.

## Key files

| Concern | File |
| --- | --- |
| Web API base URLs, dev proxy | `web/vite.config.ts` |
| Browser API client and settings | `web/src/lib/api.ts` |
| Shared DTO types | `web/src/lib/types.ts` |
| Polling hook | `web/src/hooks/use-monitor.ts` |
| Rust DTOs | `blink-monitor/crates/shared/src/models.rs` |
| Rust routes | `blink-monitor/crates/shared/src/api.rs` |
| Rust collector | `blink-monitor/crates/shared/src/collector.rs` |

## Security model

- `/healthz` is intentionally public; `/status` and `/history` require `Authorization: Bearer <BLINK_API_KEY>`.
- The Stick IR API uses a separate bearer token.
- Agents bind to loopback by default. A reverse proxy terminates TLS and maps `/blink/` to each agent.
- Browser tokens are stored in `localStorage` under `blink.settings.v1`; use a trusted browser profile.
