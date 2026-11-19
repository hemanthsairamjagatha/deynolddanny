// scripts/build-admin.mjs
// Cross-platform build helper: installs admin/ deps if missing, builds the
// Deynold Danny Commerce OS React SPA, and copies admin/dist -> dist/admin
// so Vercel serves both the Astro storefront and /admin/* from one deployment.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const adminDir = path.join(rootDir, 'admin');
const adminDistDir = path.join(adminDir, 'dist');
const targetDir = path.join(rootDir, 'dist', 'admin');

function run(cmd, cwd) {
  console.log(`[build-admin] Running: ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

if (!fs.existsSync(path.join(adminDir, 'node_modules'))) {
  const hasLock = fs.existsSync(path.join(adminDir, 'package-lock.json'));
  run(hasLock ? 'npm ci --no-audit --no-fund' : 'npm install --no-audit --no-fund', adminDir);
}

run('npm run build', adminDir);

if (!fs.existsSync(adminDistDir)) {
  throw new Error(`[build-admin] Expected build output at ${adminDistDir} not found.`);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(adminDistDir, targetDir, { recursive: true });
console.log(`[build-admin] Copied Commerce OS admin bundle -> ${targetDir}`);
