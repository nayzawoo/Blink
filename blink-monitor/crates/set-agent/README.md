# set-agent

Blink monitor binary for the **Map** host (`HOST_NAME` default `mapserver`).

- Bind: `127.0.0.1:8788` (override with `BIND_ADDR`)
- Required env: `BLINK_API_KEY`, `SET_CHECK` (HTTP/TCP health of the map/PHP site)
- Optional: `DB_PATH`, `POLL_INTERVAL_SECS`

Service check name in JSON is still `"set"`; the iOS app displays **Map**.

```bash
cd ../..   # blink-monitor/
cp .env.set.example .env
cargo run --release -p set-agent
```

Full docs: [../../README.md](../../README.md)
