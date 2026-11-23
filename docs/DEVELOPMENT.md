# Development

## Prerequisites

- Node.js >= 20.19 and npm >= 11
- Rust 1.85+ with the 2024 edition (verified with Cargo 1.99)

## Install

```bash
make install
```

This runs `npm install` in `web/`. Rust dependencies are fetched on the first Cargo command.

## Web development

```bash
make dev
```

Vite serves at <http://localhost:5173> and proxies:

| Prefix | Upstream | Rewritten path |
| --- | --- | --- |
| `/chat-api` | `https://chat.mm2d.xyz` | `/blink/*` |
| `/set-api` | `https://api.mm2d.xyz` | `/blink/*` |
| `/stick-api` | `https://chat.mm2d.xyz` | `/api/stick/ir/*` |

Override upstreams without touching code:

```bash
VITE_CHAT_UPSTREAM=https://chat.example.com make dev
```

In the UI, sign in first, then open **Settings** and paste the Blink API key. The key is saved only in this browser.

### Dashboard login

`web/src/lib/auth-credentials.ts` holds a salted PBKDF2-SHA256 verifier for the username and password. The login form derives hashes with Web Crypto and compares them in constant time. A successful sign-in is kept in `sessionStorage`; use the logout button in the header to clear it.

Rotate credentials with:

```bash
BLINK_USERNAME='new-user' BLINK_PASSWORD='new-password' make auth-hash
```

Never commit the plaintext values.

### Web scripts

```bash
npm run lint        --prefix web
npm run typecheck   --prefix web
npm run build       --prefix web
make pwa-assets     # regenerate icons from web/public/logo.svg
```

## Running the Rust agents locally

Create per-agent env files inside `blink-monitor/`:

```bash
make setup-env
# edit blink-monitor/.env: BLINK_API_KEY, CHAT_CHECK, BIND_ADDR
make monitor-run-chat
```

For the map agent, stop the chat agent, replace the env file, and start the other binary:

```bash
cp blink-monitor/.env.set.example blink-monitor/.env
# edit blink-monitor/.env: BLINK_API_KEY, SET_CHECK, BIND_ADDR=127.0.0.1:8788
cd blink-monitor && cargo run -p set-agent
```

`dotenvy` loads `.env` from the working directory, so always run Cargo from `blink-monitor/`.

Useful checks:

```bash
make monitor-check   # cargo check --workspace --all-targets
make monitor-fmt     # cargo fmt --all
make monitor-lint    # clippy, warnings denied
make monitor-test
```

## Adding a shadcn component

```bash
npx shadcn@latest add <component> --cwd web --yes
```

Then import it from `@/components/ui/<component>`.

## Full verification

```bash
make check
make build
```
