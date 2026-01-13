import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const productServiceUrl = env.VITE_PRODUCT_SERVICE_URL || 'http://localhost:8081'
  const sendJobServiceUrl = env.VITE_SENDJOB_SERVICE_URL || 'http://localhost:8082'

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
    server: {
      proxy: {
        '/product-api': {
          target: productServiceUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/product-api/, ''),
        },
        '/job-api': {
          target: sendJobServiceUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/job-api/, ''),
        },
      },
    },
  }
})
