# Deployment

## Build

```bash
make build
```

Outputs:

- `web/dist/` — static PWA (manifest, service worker, icons, assets)
- `blink-monitor/target/release/chat-agent`
- `blink-monitor/target/release/set-agent`

## Agents

Copy binaries and env files to the host, e.g. `/opt/blink-monitor/`. Never expose ports `8787`/`8788` publicly.

Example systemd unit (`/etc/systemd/system/blink-chat.service`):

```ini
[Unit]
Description=Blink chat monitor
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/blink-monitor
EnvironmentFile=/opt/blink-monitor/chat.env
ExecStart=/opt/blink-monitor/chat-agent
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Use the same unit for `blink-set.service` with `set-agent` and `set.env`.

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now blink-chat blink-set
```

Env files should set at least `BLINK_API_KEY`, `CHAT_CHECK`/`SET_CHECK`, `BIND_ADDR`, `HOST_NAME`, and `DB_PATH`.

## Reverse proxy

Serve the PWA from the same origin as the API prefixes. This avoids CORS and lets the browser reuse the configured bearer token.

```nginx
server {
    listen 443 ssl http2;
    server_name dashboard.example.com;

    root /var/www/blink-web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /blink/ {
        proxy_pass http://127.0.0.1:8787/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 10s;
    }

    location /stick-api/ {
        proxy_pass http://127.0.0.1:3020/api/stick/ir/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_read_timeout 10s;
    }
}
```

Then set the web settings to:

- Chat monitor base URL: `/blink`
- Map monitor base URL: `/api/blink` on `api.mm2d.xyz` (or your own proxy)
- Stick IR base URL: `/stick-api`

If the PWA is hosted on a different origin, add CORS headers for `GET, POST, OPTIONS` and the `Authorization, Content-Type` headers to the proxied locations.

## PWA notes

- `web/public/manifest.webmanifest` and service worker files are generated during `vite build`.
- Icons are generated from `web/public/logo.svg` by `make pwa-assets`.
- The service worker precaches the app shell but deliberately uses `NetworkOnly` for `/chat-api`, `/set-api`, and `/stick-api` so live data and IR commands are never stale.
- Update `theme-color` in `web/index.html` if you change the brand color.
