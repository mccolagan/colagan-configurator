import { defineConfig } from 'vitest/config';

// BASE_PATH : "/" en local et dans l'image nginx, "/colagan-configurator/" pour GitHub Pages
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
