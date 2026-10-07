import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const server = path.join(dist, 'server');
const workerDir = path.join(dist, '_worker.js');
const client = path.join(dist, 'client');

if (!fs.existsSync(dist)) {
  console.error('postbuild: dist/ not found. Did `astro build` succeed?');
  process.exit(1);
}

// Step 1: rename dist/server -> dist/_worker.js and entry.mjs -> index.js
// (Required by Cloudflare Pages advanced mode for the @astrojs/cloudflare adapter.)
if (fs.existsSync(server)) {
  if (fs.existsSync(workerDir)) fs.rmSync(workerDir, { recursive: true, force: true });
  fs.renameSync(server, workerDir);
  const entry = path.join(workerDir, 'entry.mjs');
  const index = path.join(workerDir, 'index.js');
  if (fs.existsSync(entry)) {
    if (fs.existsSync(index)) fs.rmSync(index, { force: true });
    fs.renameSync(entry, index);
  }
  // Remove the generated wrangler.json that Astro puts inside the server dir.
  // This file contains invalid bindings (SESSION KV without id, ASSETS reserved name)
  // that cause Cloudflare Pages to reject the deployment.
  // (We already set `session: false` in astro.config.mjs to avoid generating it,
  // but keep this cleanup for older cached builds.)
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

// Step 3: delete .wrangler/deploy/config.json if it exists.
// Cloudflare CI caches this file between builds. If it points to a path that
// no longer exists (e.g. dist/server/wrangler.json from a previous run),
// wrangler will crash before our build output is even evaluated.
const deployConfig = path.join(root, '.wrangler', 'deploy', 'config.json');
if (fs.existsSync(deployConfig)) {
  fs.unlinkSync(deployConfig);
}

console.log('postbuild: OK - dist/_worker.js ready for Cloudflare Pages.');
