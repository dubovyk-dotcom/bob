import http from 'node:http';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBusinessContactSearch, validateInput } from './src/lib/business-search.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadEnvFile(envPath) {
  try {
    await access(envPath);
  } catch {
    return;
  }

  const raw = await readFile(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

await loadEnvFile(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 3005);
const HOST = process.env.HOST || '127.0.0.1';
const APP_USER_AGENT = process.env.APP_USER_AGENT || 'BusinessContactFinder/0.1 (+https://github.com/SmallBoyRoy/business-contact-finder)';

const staticFiles = {
  '/': 'public/index.html',
  '/styles.css': 'public/styles.css',
  '/app.js': 'public/app.js'
};

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && staticFiles[req.url]) {
      const filePath = path.join(__dirname, staticFiles[req.url]);
      const content = await readFile(filePath);
      const type = req.url.endsWith('.css') ? 'text/css' : req.url.endsWith('.js') ? 'application/javascript' : 'text/html';
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      res.end(content);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/search') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const input = validateInput(payload);
          const result = await runBusinessContactSearch(input, APP_USER_AGENT);
          json(res, 200, result);
        } catch (error) {
          json(res, 400, { error: error.message || 'Bad request' });
        }
      });
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (error) {
    json(res, 500, { error: 'Internal server error', detail: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Business Contact Finder running at http://${HOST}:${PORT}`);
});
