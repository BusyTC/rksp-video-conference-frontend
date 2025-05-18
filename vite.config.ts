import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    host: true, // Listen on all addresses
    port: 5173,
    https: {
      // This enables HTTPS with proper configuration
      key: process.env.VITE_SSL_KEY_FILE,
      cert: process.env.VITE_SSL_CERT_FILE,
    },
  },
})
