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
| nginx | `:80`, `:443` | public |

Only nginx should listen publicly. Never expose `8787`, `8788`, `8790`, or `3020`.

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

## nginx reverse proxy

nginx serves the PWA and proxies the API on the same origin, so the browser defaults (`/chat-api`, `/set-api`, `/stick-api`) work without changing Settings.

| Path | Upstream | Purpose |
| --- | --- | --- |
| `/` | `127.0.0.1:8787` (or static `web/dist`) | PWA with SPA fallback |
| `/chat-api/*`, `/blink/*` | `127.0.0.1:8790` | chat monitor |
| `/set-api/*`, `/api/blink/*` | `127.0.0.1:8788` (or `https://api.mm2d.xyz/blink`) | map monitor |
| `/stick-api/*` | `127.0.0.1:3020` | Stick IR (`/commands` → `/api/stick/ir/commands`) |

### mm2d.xyz production edge (nginx stream on `:443` + HTTP on `127.0.0.1:8443`)

On the production host, nginx `stream` owns public `:443`, uses `ssl_preread` on the SNI to route special names to xray Reality, and forwards everything else to nginx `http` on `127.0.0.1:8443`.

1. Point `blink.mm2d.xyz` at the host and allow inbound `80`/`443`.
2. Issue a certificate via the `/var/www/certbot` webroot:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d blink.mm2d.xyz \
  --deploy-hook "systemctl reload nginx"
```

3. Move `chat-agent` off port `8787` by setting `BIND_ADDR=127.0.0.1:8790` in `/opt/blink-monitor/chat.env`, restarting `blink-chat`, and updating the `/blink/` upstream in `/etc/nginx/sites-available/chat.conf` to `127.0.0.1:8790`.
4. Add an nginx server block (e.g. `/etc/nginx/sites-available/blink.conf`), symlink it into `/etc/nginx/sites-enabled/`, then run `sudo nginx -t && sudo systemctl reload nginx`.

### Example nginx config

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name blink.mm2d.xyz;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 127.0.0.1:8443 ssl; # or `listen 443 ssl http2;` if not behind nginx stream
    server_name blink.mm2d.xyz;

    ssl_certificate /etc/letsencrypt/live/blink.mm2d.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blink.mm2d.xyz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

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

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Alternatively, nginx can serve `web/dist` directly (`root /var/www/blink-web; try_files $uri $uri/ /index.html;`) instead of proxying to the PM2 process.

If the PWA is hosted on a different origin, add CORS headers for `GET, POST, OPTIONS` and the `Authorization, Content-Type` headers to the proxied locations.

## PWA notes

- `web/public/manifest.webmanifest` and service worker files are generated during `vite build`.
- Icons are generated from `web/public/logo.svg` by `make pwa-assets`.
- The service worker precaches the app shell but deliberately uses `NetworkOnly` for `/chat-api`, `/set-api`, and `/stick-api` so live data and IR commands are never stale.
- Update `theme-color` in `web/index.html` if you change the brand color.
