// Settings for Vite (the dev server and build) and Vitest (the unit tests).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    host: true, // also listen on your Wi-Fi address, so a phone can try the dev version
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/screens/**', 'src/render/draw.ts'], // canvas + screens: Playwright covers them
    },
  },
});
