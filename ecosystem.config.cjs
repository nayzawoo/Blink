/**
 * PM2 configuration for the production Blink PWA.
 *
 * `script: "serve"` is PM2's built-in static file server. It serves the Vite
 * build in `web/dist` with SPA fallback on 127.0.0.1:8787; nginx terminates
 * TLS and proxies the public domain to it.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 reload blink-web --update-env   # after `npm run build --prefix web`
 *   pm2 logs blink-web
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: "blink-web",
      script: "serve",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      env: {
        PM2_SERVE_PATH: "./web/dist",
        PM2_SERVE_HOST: "127.0.0.1",
        PM2_SERVE_PORT: "8787",
        PM2_SERVE_SPA: "true",
        PM2_SERVE_HOMEPAGE: "/index.html",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      max_memory_restart: "256M",
      kill_timeout: 5000,
      watch: false,
      time: true,
    },
  ],
}
