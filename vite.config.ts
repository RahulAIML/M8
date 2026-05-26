import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/sanfer': {
        target: 'https://serv.aux-rolplay.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT ?? '4174'),
    allowedHosts: ['dashboard-sanfer.onrender.com', 'sanfer-dashboard.onrender.com'],
    proxy: {
      '/sanfer': {
        target: 'https://serv.aux-rolplay.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
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
