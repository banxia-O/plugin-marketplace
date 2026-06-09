import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 本地开发把 /api 代理到本地 Worker（wrangler dev），实现与生产一致的同源访问。
const apiProxy = process.env.VITE_API_PROXY || 'http://localhost:8787';
const proxy = { '/api': { target: apiProxy, changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
