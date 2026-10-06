import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const server = path.join(dist, 'server');
const workerDir = path.join(dist, '_worker.js');
const client = path.join(dist, 'client');

// Step 1: rename dist/server → dist/_worker.js and entry.mjs → index.js
if (fs.existsSync(server)) {
  fs.renameSync(server, workerDir);
  const entry = path.join(workerDir, 'entry.mjs');
  const index = path.join(workerDir, 'index.js');
  if (fs.existsSync(entry)) {
    fs.renameSync(entry, index);
  }
  // Remove the generated wrangler.json that Astro puts inside the server dir
  const wranglerJson = path.join(workerDir, 'wrangler.json');
  if (fs.existsSync(wranglerJson)) {
    fs.unlinkSync(wranglerJson);
  }
}

// Step 2: move static assets from dist/client up to dist/
if (fs.existsSync(client)) {
  const files = fs.readdirSync(client);
  for (const file of files) {
    const src = path.join(client, file);
    const dest = path.join(dist, file);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true });
  }
  fs.rmSync(client, { recursive: true, force: true });
}

// Step 3: overwrite .wrangler/deploy/config.json to remove any stale pointer
// that Cloudflare CI may have cached from a previous build. This file redirects
// wrangler to use a generated wrangler.json instead of our wrangler.jsonc.
// By resetting it to an empty object we ensure it doesn't override our config.
const wranglerDeployDir = path.join(root, '.wrangler', 'deploy');
fs.mkdirSync(wranglerDeployDir, { recursive: true });
fs.writeFileSync(path.join(wranglerDeployDir, 'config.json'), '{}', 'utf-8');

