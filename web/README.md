# Blink Web

React 19 + Vite 8 + Tailwind 4 + shadcn PWA for the Blink dashboard.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run generate-pwa-assets
```

From the repository root, `make dev`, `make check`, and `make build` are the preferred shortcuts.

## Structure

- `src/App.tsx` — dashboard layout
- `src/components/server-card.tsx` — live monitor cards
- `src/components/remote-panel.tsx` — Samsung Stick IR remote
- `src/hooks/use-monitor.ts` — polling and history
- `src/lib/api.ts` — settings and fetch functions
- `src/lib/types.ts` — monitor DTOs
- `vite.config.ts` — PWA manifest, dev proxies, Tailwind/React plugins

See `../docs/ARCHITECTURE.md` and `../docs/API.md` for details.

## Adding components

```bash
npx shadcn@latest add <component> --cwd . --yes
```
