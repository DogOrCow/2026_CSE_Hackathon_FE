import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const { API_PROXY_TARGET } = loadEnv(mode, process.cwd(), 'API_PROXY_TARGET')
  const target = API_PROXY_TARGET?.trim()
  const proxy = target ? { '^/api(?:/|$)': { target, changeOrigin: true } } : undefined

  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
