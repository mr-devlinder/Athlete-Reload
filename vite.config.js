import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = mode === 'e2e' ? {} : loadEnv(mode, process.cwd(), '')

  return {
    base: mode === 'production' ? (env.VITE_BASE_PATH || '/Athlete-Reload/') : '/',
    envDir: mode === 'e2e' ? './tests/e2e/env' : undefined,
    build: {
      chunkSizeWarningLimit: 850,
      cssMinify: 'lightningcss',
    },
    plugins: [react()],
    test: {
      exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    },
    server: {
      proxy: {
        '/local-functions': {
          target: env.VITE_SUPABASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/local-functions/, '/functions/v1'),
        },
      },
    },
  }
})
