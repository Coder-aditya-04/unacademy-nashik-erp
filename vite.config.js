import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    proxy: {
      '/telecrm-api': {
        target: 'https://next-api.telecrm.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/telecrm-api/, ''),
        secure: false, // Ensure SSL works
      }
    }
  }
})
