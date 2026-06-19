import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/m8/bridge': {
        target: 'https://rolplay.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/m8\/bridge/, '/ajax'),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT ?? '4175'),
    allowedHosts: ['dashboard-m8.onrender.com', 'm8-dashboard.onrender.com'],
    proxy: {
      '/m8/bridge': {
        target: 'https://rolplay.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/m8\/bridge/, '/ajax'),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
          'vendor-ai': ['@google/generative-ai', 'react-markdown'],
          'vendor-icons': ['lucide-react'],
          'vendor-dates': ['date-fns'],
        },
      },
    },
  },
})
