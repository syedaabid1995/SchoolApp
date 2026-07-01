import fs from 'node:fs';
import path from 'node:path';

const backendRoot = path.basename(process.cwd()) === 'backend'
  ? process.cwd()
  : path.join(process.cwd(), 'backend');

const requiredEntrypoints = [
  'dist/server.js',
  'dist/worker.js',
  'dist/scheduler.js',
];

const checked = requiredEntrypoints.map((entrypoint) => {
  const absolutePath = path.join(backendRoot, entrypoint);
  const exists = fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
  return { entrypoint, exists };
});

const missing = checked.filter((entry) => !entry.exists).map((entry) => entry.entrypoint);

console.log(JSON.stringify({
  ok: missing.length === 0,
  checked,
  missing,
}, null, 2));

if (missing.length) {
  process.exitCode = 1;
}
