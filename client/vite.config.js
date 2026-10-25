import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const configuredApiPort = Number(process.env.PORT || 5000);
const apiPort = Number.isInteger(configuredApiPort) && configuredApiPort > 0 && configuredApiPort <= 65535
  ? configuredApiPort
  : 5000;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
