# chat-agent

Blink monitor binary for the **chat** host (`HOST_NAME` default `chatserver`).

- Bind: `127.0.0.1:8787` (override with `BIND_ADDR`)
- Required env: `BLINK_API_KEY`, `CHAT_CHECK`
- Optional: `RECORD_CHECK`, `DB_PATH`, `POLL_INTERVAL_SECS`

```bash
cd ../..   # blink-monitor/
cp .env.chat.example .env
cargo run --release -p chat-agent
```

Full docs: [../../README.md](../../README.md)
