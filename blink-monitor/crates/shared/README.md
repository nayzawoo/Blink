# blink-monitor-shared

Library used by `chat-agent` and `set-agent`:

| Module | Role |
|--------|------|
| `config` | env → `Config` (key, bind, checks, 1h retain) |
| `collector` | sysinfo + health check loop, SQLite insert/prune, optional Slack alerts |
| `slack` | Incoming Webhook helper |
| `db` | samples / rollups |
| `api` | Axum `/healthz`, `/status`, `/history` |
| `auth` | Bearer `BLINK_API_KEY` |
| `models` | status + history JSON |

Not a runnable binary. See [../../README.md](../../README.md).
