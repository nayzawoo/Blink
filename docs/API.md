# API reference

## Monitor agents

Base paths in production are typically `https://chat.mm2d.xyz/blink` and `https://api.mm2d.xyz/blink`. In development use the Vite proxy prefixes `/chat-api` and `/set-api`.

All monitor endpoints except `/healthz` require:

```http
Authorization: Bearer <BLINK_API_KEY>
```

### `GET /healthz`

Returns `200 OK` when the agent process is alive. No authentication.

### `GET /status`

Returns the latest sample. Responds `503` before the first collection tick.

```json
{
  "agent": "chatserver",
  "host": "chatserver",
  "ok": true,
  "cpu_pct": 12.4,
  "cpu_cores": [8.1, 15.2, 4.0, 9.9],
  "mem": { "used_bytes": 2147483648, "total_bytes": 8589934592, "used_pct": 25.0 },
  "disk": { "used_bytes": 50000000000, "total_bytes": 200000000000, "used_pct": 25.0 },
  "services": [{ "name": "chat", "up": true }],
  "top_processes": [{ "pid": 1234, "name": "nginx", "cpu_pct": 2.1 }],
  "updated_at": "2026-11-23T14:00:00Z"
}
```

`ok` reflects the first configured service check. The dashboard also marks the server down if any service in `services` is `false`.

### `GET /history?range=1h`

Returns the last hour of samples. `range` is accepted for compatibility but currently always resolves to one hour.

```json
[
  {
    "ts": "2026-11-23T13:59:59Z",
    "cpu_pct": 11.8,
    "mem_used_pct": 24.9,
    "disk_used_pct": 25.0,
    "services": { "chat": true }
  }
]
```

The web app downsamples this to 180 points for the history chart.

## Stick IR remote

Base path in production is `https://chat.mm2d.xyz`; in development use `/stick-api`. Requires a separate token:

```http
Authorization: Bearer <STICK_IR_API_TOKEN>
Content-Type: application/json
```

### `POST /api/stick/ir/commands`

```json
{ "cmd": "vol_up" }
```

Responds `201` with:

```json
{
  "id": "01J...",
  "cmd": "vol_up",
  "created_at": "2026-11-23T14:00:00Z"
}
```

Valid commands: `power`, `source`, `mute`, `prev`, `vol_up`, `vol_down`, `ch_up`, `ch_down`, `0`–`9`.

The server keeps a single pending command slot: a new command replaces the previous one. The UI therefore allows rapid presses without disabling buttons.

Errors: `401` for a bad token, other non-2xx responses surface as HTTP errors in the remote footer.

## Exchange rates

The optional rates card reads the public Firebase RTDB endpoint used by the iOS app:

```text
https://myanexchanger-rates-default-rtdb.asia-southeast1.firebasedatabase.app/.json
```

Only `payoneer.buy_current`, `payoneer.buy_previous`, and `wise.buy_current` are displayed.
