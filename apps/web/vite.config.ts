import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Em desenvolvimento, o front e a API ficam na MESMA origem para o navegador: o Vite
// encaminha /api para a API. Em produção quem faz isso é o Caddy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
  },
  build: { sourcemap: false },
});
