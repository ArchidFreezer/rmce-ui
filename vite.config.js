import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change target to your API origin (e.g., http://localhost:3000)
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/rmce': {
        target: 'http://192.168.1.109:8080',
        changeOrigin: true,
      },
    },
  },
})