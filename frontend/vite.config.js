import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // In production (Vercel), VITE_API_BASE is set to the Render backend URL.
  // In local dev, proxy to localhost so CORS is not needed.
  const backendUrl = env.VITE_API_BASE || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/students': backendUrl,
        '/scans':    backendUrl,
        '/model':    backendUrl,
      }
    }
  }
})
