import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: mode === 'production' ? (env.VITE_BASE_PATH || '/Athlete-Reload/') : '/',
    build: {
      chunkSizeWarningLimit: 850,
      cssMinify: 'lightningcss',
    },
    plugins: [react()],
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
