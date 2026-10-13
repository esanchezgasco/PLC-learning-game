import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// @ts-expect-error mòdul JS del servidor sense tipus
import { createAiMiddleware } from './server/ai-handler.mjs';

// La capa d'IA s'executa al servidor (middleware de Vite en desenvolupament i
// server/server.mjs en producció). Les claus API es llegeixen de l'entorn i
// mai s'exposen al navegador (no fan servir el prefix VITE_).
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  const aiPlugin = {
    name: 'studyflow-ai-api',
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(createAiMiddleware(env));
    },
    configurePreviewServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(createAiMiddleware(env));
    },
  };
  return {
    // mode 'artifact': build amb rutes relatives per publicar-la com a pàgina estàtica
    base: mode === 'artifact' ? './' : '/',
    plugins: [react(), tailwindcss(), aiPlugin],
    server: { port: 5173 },
    build: { chunkSizeWarningLimit: 2000 },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
