# blink-monitor

Rust workspace: two small agents that expose the same HTTP API for the Blink iPhone app.

| Binary | Typical host | Health check env | Bind |
|--------|--------------|------------------|------|
| [`chat-agent`](crates/chat-agent) | `chatserver` | `CHAT_CHECK` | `127.0.0.1:8787` |
| [`set-agent`](crates/set-agent) | `mapserver` | `SET_CHECK` | `127.0.0.1:8788` |

Shared library [`crates/shared`](crates/shared): collector (`sysinfo`), SQLite, Axum routes, Bearer auth.

## Layout

```
blink-monitor/
├── crates/shared/       # config, collector, db, api, auth, models
├── crates/chat-agent/   # binary → chat server
├── crates/set-agent/    # binary → map server
├── .env.chat.example
└── .env.set.example
```

## What each agent does

1. Every `POLL_INTERVAL_SECS` (default **1**): sample CPU, RAM, disk; run health check(s).
2. Write a row into SQLite `samples`.
3. Keep an in-memory “latest” snapshot for `GET /status`.
4. If `SLACK_WEBHOOK_URL` is set: after continuous DOWN ≥ `SLACK_DOWN_SECS`, post Slack once; post again on UP.
5. About every 60 loops: prune rows older than **1 hour** (and rollups).
6. Serve local HTTP (usually behind nginx TLS at `/blink/`).

### Health checks

| Env | Format | Example |
|-----|--------|---------|
| `CHAT_CHECK` | `host:port` (TCP) or `http(s)://…` | `127.0.0.1:3009` |
| `SET_CHECK` | TCP or HTTP URL | `https://mm2d.xyz/` |
| `RECORD_CHECK` | optional second check (chat only) | — |

HTTP targets count as **up** only on **2xx**. TCP is up if connect succeeds within ~2s.

## Build

```bash
cd blink-monitor
cargo build --release -p chat-agent
cargo build --release -p set-agent
```

Binaries: `target/release/chat-agent`, `target/release/set-agent`.

## Configure

### Chat

```bash
cp .env.chat.example .env
# required: BLINK_API_KEY, CHAT_CHECK
# optional: BIND_ADDR, HOST_NAME, DB_PATH, POLL_INTERVAL_SECS, RECORD_CHECK
# optional Slack: SLACK_WEBHOOK_URL, SLACK_DOWN_SECS (default 5)
```

### Map (set-agent)

```bash
cp .env.set.example .env
# required: BLINK_API_KEY, SET_CHECK
# HOST_NAME defaults to mapserver
# optional Slack: SLACK_WEBHOOK_URL, SLACK_DOWN_SECS (default 5)
```

`BLINK_API_KEY` must be ≥ 16 characters and match `Blink/Secrets.plist` on the phone.

### Slack alerts

Set `SLACK_WEBHOOK_URL` to a Slack Incoming Webhook. When a health check stays **down**
for `SLACK_DOWN_SECS` (default **5**), the agent posts once; it posts again on recovery.
Omit the env var to disable. Never commit the webhook URL.

## Run

```bash
# from blink-monitor/ with .env present
cargo run --release -p chat-agent
cargo run --release -p set-agent
```

Production-style (example):

```bash
export PATH=/root/.cargo/bin:$PATH
cd /opt/blink-monitor
cargo build --release -p chat-agent   # or set-agent
systemctl restart chat-agent          # or set-agent
```

Typical unit: `WorkingDirectory=/opt/blink-monitor`, `EnvironmentFile=/opt/blink-monitor/.env`,  
`ExecStart=/opt/blink-monitor/target/release/chat-agent`.

## API

All routes (except you should still protect the port) require:

```http
Authorization: Bearer <BLINK_API_KEY>
```

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/healthz` | liveness |
| `GET` | `/status` | latest snapshot JSON |
| `GET` | `/history?range=1h` | samples for last hour |

`range=2d` is accepted but **capped to 1 hour** (retention policy).

### Curl

```bash
KEY='your_blink_api_key'

curl -sS -X GET \
  -H "Authorization: Bearer $KEY" \
  -H "Accept: application/json" \
  https://chat.mm2d.xyz/blink/status | python3 -m json.tool

curl -sS -X GET \
  -H "Authorization: Bearer $KEY" \
  -H "Accept: application/json" \
  https://api.mm2d.xyz/blink/status | python3 -m json.tool

curl -sS -m 60 -H "Authorization: Bearer $KEY" \
  "https://chat.mm2d.xyz/blink/history?range=1h" | python3 -m json.tool | less
```

Local (on the server, agent bound to localhost):

```bash
curl -sS -H "Authorization: Bearer $KEY" http://127.0.0.1:8787/status
curl -sS -H "Authorization: Bearer $KEY" http://127.0.0.1:8788/status
```

### Status shape (abbrev.)

```json
{
  "agent": "chat-agent",
  "host": "chatserver",
  "ok": true,
  "cpu_pct": 12.3,
  "cpu_cores": [10.1, 8.4, 15.2, 11.0],
  "mem": { "used_bytes": 0, "total_bytes": 0, "used_pct": 0 },
  "disk": { "used_bytes": 0, "total_bytes": 0, "used_pct": 0 },
  "services": [{ "name": "chat", "up": true }],
  "top_processes": [
    { "pid": 1234, "name": "node", "cpu_pct": 42.5 },
    { "pid": 56, "name": "nginx", "cpu_pct": 3.1 },
    { "pid": 78, "name": "chat-agent", "cpu_pct": 1.2 }
  ],
  "updated_at": "2026-11-08T12:00:00Z"
}
```

Map agent uses `"host": "mapserver"` and service name `"set"` (iOS UI labels it **Map**).

## SQLite retention

| Setting | Value |
|---------|--------|
| `sample_retain` | **1 hour** |
| `rollup_retain` | **1 hour** |
| Prune cadence | ~every 60 poll loops |

Default relative paths in examples: `data/*-agent.db`.  
Deployed hosts often use:

- `/var/lib/blink-monitor/chat-agent.db`
- `/var/lib/blink-monitor/set-agent.db`

Reset DB (stop agent → delete `.db` / `-wal` / `-shm` → start):

```bash
systemctl stop chat-agent
rm -f /var/lib/blink-monitor/chat-agent.db*

systemctl start chat-agent
```

## nginx

Expose only via TLS reverse proxy, e.g.:

```nginx
location /blink/ {
    proxy_pass http://127.0.0.1:8787/;   # 8788 on mapserver
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 10s;
}
```

Do not open `8787` / `8788` on the public interface.

## Security

- Random long `BLINK_API_KEY` (same on phone + both agents if you share one key).
- Agents listen on `127.0.0.1` only; TLS at nginx.
- Never commit `.env` or production keys.
