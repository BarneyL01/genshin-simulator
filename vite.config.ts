import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const git = (cmd: string): string => {
  try { return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
};
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
/** Shown in the page header so it is clear which build is running. */
const BUILD = {
  version: pkg.version,
  commit: (process.env.GITHUB_SHA ?? git('rev-parse HEAD')).slice(0, 7) || 'dev',
  dirty: git('status --porcelain') !== '',
  date: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
};

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  base: process.env.BASE_PATH ?? './',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 120_000 },
});
