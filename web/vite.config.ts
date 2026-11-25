import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { VitePWA } from "vite-plugin-pwa"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  const chatUpstream = env.VITE_CHAT_UPSTREAM || "https://chat.mm2d.xyz"
  const setUpstream = env.VITE_SET_UPSTREAM || "https://api.mm2d.xyz"
  const stickUpstream = env.VITE_STICK_UPSTREAM || "https://chat.mm2d.xyz"

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["favicon.ico", "logo.svg", "apple-touch-icon-180x180.png", "push-sw.js"],
        manifest: {
          id: "/",
          name: "Blink · IoT Dashboard",
          short_name: "Blink",
          description: "Server status and IoT remote dashboard",
          lang: "en",
          dir: "ltr",
          theme_color: "#141414",
          background_color: "#141414",
          display: "standalone",
          display_override: ["window-controls-overlay", "standalone"],
          orientation: "any",
          start_url: "/",
          scope: "/",
          categories: ["utilities", "productivity"],
          shortcuts: [
            {
              name: "Server Status",
              short_name: "Servers",
              description: "View live server telemetry",
              url: "/#servers",
              icons: [{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" }],
            },
            {
              name: "Samsung TV Remote",
              short_name: "TV Remote",
              description: "Open Stick IR TV remote",
              url: "/#remote",
              icons: [{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" }],
            },
          ],
          icons: [
            { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          importScripts: ["/push-sw.js"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/(chat-api|set-api|stick-api|blink|api)\//],
          globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                ["/chat-api", "/set-api", "/stick-api", "/blink", "/api"].some((prefix) =>
                  url.pathname.startsWith(prefix)
                ),
              handler: "NetworkOnly",
              options: { cacheName: "blink-live-api" },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "./src"),
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 8787,
      strictPort: true,
    },
    server: {
      proxy: {
        "/chat-api": {
          target: chatUpstream,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/chat-api/, "/blink"),
        },
        "/set-api": {
          target: setUpstream,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/set-api/, "/blink"),
        },
        "/stick-api": {
          target: stickUpstream,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/stick-api/, "/api/stick/ir"),
        },
      },
    },
  }
})
