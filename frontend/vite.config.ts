import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // See index.html's comment on the <script src="/katex.min.js"> tag: this project's
      // bundler corrupts katex's own tokenizer when it processes the module normally, so
      // react-katex's `import katex from 'katex'` is redirected to the unbundled global build
      // instead. Exact-match regex only -- a plain string key here also (wrongly) rewrites
      // Tailwind's `@import "katex/dist/katex.min.css"` in index.css to the same target.
      { find: /^katex$/, replacement: fileURLToPath(new URL('./src/katex-global-shim.ts', import.meta.url)) },
    ],
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
