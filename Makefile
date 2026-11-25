.DEFAULT_GOAL := help

.PHONY: help install dev build check clean auth-hash \
        web-install web-dev web-build web-lint web-format web-typecheck web-pwa-assets \
        monitor-check monitor-build monitor-test monitor-fmt monitor-lint \
        monitor-run-chat monitor-run-set setup-env \
        pm2-start pm2-reload pm2-stop pm2-status pm2-logs pm2-save

help: ## Show available shortcuts
	@awk 'BEGIN { FS = ":.*## "; printf "\nUsage: make <target>\n\n" } /^[a-zA-Z0-9_-]+:.*## / { printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2 } END { printf "\n" }' $(MAKEFILE_LIST)

## Web

install: web-install ## Install web dependencies

web-install:
	cd web && npm install

dev: web-dev ## Start the Vite dev server at http://localhost:5173

web-dev:
	cd web && npm run dev

web-build: ## Build the production PWA
	cd web && npm run build

web-lint: ## Lint the web app
	cd web && npm run lint

web-typecheck: ## Typecheck the web app
	cd web && npm run typecheck

web-format: ## Format web sources
	cd web && npm run format

pwa-assets: web-pwa-assets ## Regenerate PWA icons from web/public/logo.svg

web-pwa-assets:
	cd web && npm run generate-pwa-assets

## Rust monitor

monitor-check: ## Check the Rust workspace
	cd blink-monitor && cargo check --workspace --all-targets

monitor-build: ## Build release binaries
	cd blink-monitor && cargo build --release --workspace

monitor-test: ## Run Rust tests
	cd blink-monitor && cargo test --workspace

monitor-fmt: ## Format Rust sources
	cd blink-monitor && cargo fmt --all

monitor-lint: ## Clippy with warnings denied
	cd blink-monitor && cargo clippy --all-targets --all-features -- -D warnings

monitor-run-chat: ## Run chat-agent with blink-monitor/.env
	cd blink-monitor && cargo run -p chat-agent

monitor-run-set: ## Run set-agent with blink-monitor/.env
	cd blink-monitor && cargo run -p set-agent

setup-env: ## Create blink-monitor/.env from the chat example
	@test -f blink-monitor/.env || cp blink-monitor/.env.chat.example blink-monitor/.env
	@echo "Edit blink-monitor/.env before starting an agent."

auth-hash: ## Print a new PBKDF2 credential block for web/src/lib/auth-credentials.ts
	@node scripts/generate-auth-hash.mjs

## Production

pm2-start: web-build ## Build the PWA and start or reload it under PM2 on 127.0.0.1:8787
	pm2 startOrReload ecosystem.config.cjs --update-env

pm2-reload: web-build ## Rebuild and reload the PM2 web process
	pm2 reload blink-web --update-env

pm2-stop: ## Remove the PM2 web process
	-pm2 delete blink-web

pm2-status: ## Show PM2 process status
	pm2 status

pm2-logs: ## Tail the PM2 web logs
	pm2 logs blink-web

pm2-save: ## Persist the current PM2 process list
	pm2 save

## Aggregate

check: web-lint web-typecheck monitor-check ## Run all lint/typecheck/check tasks

build: web-build monitor-build ## Build web + monitor binaries

clean: ## Remove build output and installed dependencies
	rm -rf web/dist web/node_modules blink-monitor/target
