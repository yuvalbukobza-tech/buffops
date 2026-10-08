import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// BuffOps v2 is served from GitHub Pages next to v1: https://<user>.github.io/buffops/v2/
// `npm run build` writes the static site into ../v2 (committed to the repo).
export default defineConfig({
  base: '/buffops/v2/',
  plugins: [react()],
  build: {
    outDir: '../v2',
    emptyOutDir: true,
  },
  // Windows short (8.3) vs long temp paths confuse Vite's dev file allow-list; dev server only.
  server: { fs: { strict: false } },
  test: {
    environment: 'node',
  },
})
