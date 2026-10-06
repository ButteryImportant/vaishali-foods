import fs from 'node:fs';
import path from 'node:path';

const dist = path.join(process.cwd(), 'dist');
const server = path.join(dist, 'server');
const workerDir = path.join(dist, '_worker.js');
const client = path.join(dist, 'client');

if (fs.existsSync(server)) {
  fs.renameSync(server, workerDir);
  const entry = path.join(workerDir, 'entry.mjs');
  const index = path.join(workerDir, 'index.js');
  if (fs.existsSync(entry)) {
    fs.renameSync(entry, index);
  }
  const wranglerJson = path.join(workerDir, 'wrangler.json');
  if (fs.existsSync(wranglerJson)) {
    fs.unlinkSync(wranglerJson);
  }
}

if (fs.existsSync(client)) {
  const files = fs.readdirSync(client);
  for (const file of files) {
    fs.cpSync(path.join(client, file), path.join(dist, file), { recursive: true });
  }
  fs.rmSync(client, { recursive: true, force: true });
}
