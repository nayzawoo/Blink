# Deployment

## Build

```bash
make build
```

Outputs:

- `web/dist/` — static PWA (manifest, service worker, icons, assets)
- `blink-monitor/target/release/chat-agent`
- `blink-monitor/target/release/set-agent`

## Ports

| Service | Bind | Exposure |
| --- | --- | --- |
| PWA (`blink-web` under PM2) | `127.0.0.1:8787` | loopback only |
| `chat-agent` | `127.0.0.1:8790` | loopback only |
| `set-agent` | `127.0.0.1:8788` | loopback only |
| Stick IR API | `127.0.0.1:3020` | loopback only |
| Caddy | `:80`, `:443` | public |

Only Caddy should listen publicly. Never expose `8787`, `8788`, `8790`, or `3020`.

## Web app with PM2

`ecosystem.config.cjs` runs PM2's built-in static server against `web/dist` on `127.0.0.1:8787` with SPA fallback to `index.html`.

```bash
npm install --prefix web
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # run the sudo command PM2 prints
```

After a rebuild, reload the process so PM2 picks up the new assets:

```bash
make pm2-reload     # web-build + pm2 reload blink-web --update-env
pm2 logs blink-web
```

Other shortcuts: `make pm2-status`, `make pm2-stop`, `make pm2-save`.

`make pm2-start` builds the PWA and starts or reloads the same process.

## Agents

Copy binaries and env files to the host, e.g. `/opt/blink-monitor/`. The chat agent defaults to port **8790** so that `8787` stays free for the PWA; set `BIND_ADDR=127.0.0.1:8790` explicitly in `chat.env`.

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

## Caddy reverse proxy

[`deploy/Caddyfile`](../deploy/Caddyfile) serves the PWA and proxies the API on the same origin, so the browser defaults (`/chat-api`, `/set-api`, `/stick-api`) work without changing Settings. Caddy obtains and renews TLS certificates automatically; point an `A`/`AAAA` record for `BLINK_DOMAIN` at the host and allow inbound `80`/`443`.

| Path | Upstream | Purpose |
| --- | --- | --- |
| `/` | `127.0.0.1:8787` | PM2-served PWA with SPA fallback |
| `/chat-api/*`, `/blink/*` | `127.0.0.1:8790` | chat monitor |
| `/set-api/*`, `/api/blink/*` | `127.0.0.1:8788` | map monitor |
| `/stick-api/*` | `127.0.0.1:3020` | Stick IR (`/commands` → `/api/stick/ir/commands`) |

Install Caddy, then copy the config and environment file:

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo mkdir -p /etc/blink
sudo cp deploy/caddy.env.example /etc/blink/caddy.env
sudo editor /etc/blink/caddy.env    # set BLINK_DOMAIN and upstreams
```

`/etc/blink/caddy.env`:

```dotenv
BLINK_DOMAIN=blink.mm2d.xyz
WEB_UPSTREAM=127.0.0.1:8787
CHAT_AGENT=127.0.0.1:8790
SET_AGENT=127.0.0.1:8788
STICK_IR=127.0.0.1:3020
```

Pass that file to Caddy with a systemd drop-in (`/etc/systemd/system/caddy.service.d/blink.conf`):

```ini
[Service]
EnvironmentFile=/etc/blink/caddy.env
```

Then validate and start:

```bash
sudo systemctl daemon-reload
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl enable --now caddy
```

Local test without a public domain:

```bash
BLINK_DOMAIN=localhost make caddy-run
```

`make caddy-check` validates `deploy/Caddyfile` without starting Caddy.

If `set-agent` runs on another host, point `SET_AGENT` at it and add the `/blink` prefix that the remote agent expects; the default assumes the same loopback host as the chat agent.

### Alternative: nginx

```nginx
server {
    listen 443 ssl http2;
    server_name blink.mm2d.xyz;

    root /var/www/blink-web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /chat-api/ {
        proxy_pass http://127.0.0.1:8790/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 10s;
    }

    location /set-api/ {
        proxy_pass http://127.0.0.1:8788/;
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

Nginx would serve `web/dist` directly (`/var/www/blink-web`) instead of the PM2 process.

If the PWA is hosted on a different origin, add CORS headers for `GET, POST, OPTIONS` and the `Authorization, Content-Type` headers to the proxied locations.

## PWA notes

- `web/public/manifest.webmanifest` and service worker files are generated during `vite build`.
- Icons are generated from `web/public/logo.svg` by `make pwa-assets`.
- The service worker precaches the app shell but deliberately uses `NetworkOnly` for `/chat-api`, `/set-api`, and `/stick-api` so live data and IR commands are never stale.
- Update `theme-color` in `web/index.html` if you change the brand color.
