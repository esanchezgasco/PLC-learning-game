// Servidor de producció: serveix l'aplicació compilada (dist/) i l'API d'IA.
// Ús: npm run build && npm start   →  http://localhost:8787
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAiMiddleware } from './ai-handler.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(root, 'dist');

// Carrega .env (format CLAU=valor) sense dependències externes
const envFile = path.join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const ai = createAiMiddleware(process.env);

const server = http.createServer((req, res) => {
  ai(req, res, async () => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let file = path.join(dist, urlPath);
      if (!file.startsWith(dist)) {
        res.statusCode = 403;
        return res.end();
      }
      const s = await stat(file).catch(() => null);
      if (!s || s.isDirectory()) file = path.join(dist, 'index.html'); // SPA
      const data = await readFile(file);
      res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
      res.end(data);
    } catch {
      res.statusCode = 500;
      res.end('No s’ha trobat dist/. Executa primer: npm run build');
    }
  });
});

const port = Number(process.env.PORT || 8787);
server.listen(port, () => console.log(`StudyFlow disponible a http://localhost:${port}`));
