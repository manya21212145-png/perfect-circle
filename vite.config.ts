// Settings for Vite (dev server + build), the PWA plugin, and Vitest (unit tests).
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: true, // also listen on your Wi-Fi address
    // While developing (npm run dev), send API and duel traffic to the PC server on port 3000
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  plugins: [
    // Step 11: installable app with offline caching
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Perfect Circle',
        short_name: 'Perfect Circle',
        description: 'Draw a shape around the dot and get an accuracy score.',
        theme_color: '#F6F6F1',
        background_color: '#F6F6F1',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//], // never cache server data
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 300,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'server/**/*.ts'],
      // Canvas drawing and screens are covered by Playwright (Unit Test Document, Strategy)
      exclude: ['src/main.ts', 'src/screens/**', 'src/render/**', 'src/state.ts', 'server/index.ts'],
    },
  },
});
