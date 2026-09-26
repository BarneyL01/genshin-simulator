import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

/**
 * Browser smoke test: serves the built app (run `npm run build` first) and drives every tab.
 *   npm run e2e            headless run, screenshots in .cache/shots
 */
const PORT = 4179;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const url = `http://localhost:${PORT}/`;
const shots = '.cache/shots';

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server did not start');
}

const errors: string[] = [];
try {
  await waitForServer();
  const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  await page.goto(url);
  await page.getByRole('heading', { name: 'Genshin Team Simulator' }).waitFor();
  console.log('loaded:', await page.locator('header p').innerText());

  // Roster
  await page.getByRole('button', { name: 'Own everything' }).click();
  await page.screenshot({ path: `${shots}/1-roster.png`, fullPage: true });

  // Known teams
  await page.getByRole('tab', { name: 'Known teams' }).click();
  await page.getByRole('button', { name: /Rank teams I can build/ }).click();
  await page.getByText(/DPS relaxed/).first().waitFor({ timeout: 120_000 });
  await page.getByText(/DPS relaxed/).nth(1).waitFor({ timeout: 120_000 });
  console.log('ranking:\n' + (await page.locator('ol > li').allInnerTexts()).map((t) => '  ' + t.split('\n').slice(0, 2).join(' | ')).join('\n'));
  await page.getByRole('button', { name: 'Show details' }).first().click();
  await page.screenshot({ path: `${shots}/2-teams.png`, fullPage: true });
  for (const [tab, name] of [['Action timeline', '3-actions'], ['Buff timeline', '4-buffs'], ['Hit log', '5-hits'], ['Assumptions', '6-assumptions']] as const) {
    await page.getByRole('tab', { name: tab }).click();
    await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
  }

  // Custom team
  await page.getByRole('tab', { name: 'Custom team' }).click();
  for (const n of ['Xingqiu', 'Bennett', 'Xiangling', 'Raiden Shogun']) await page.getByLabel(n, { exact: true }).check();
  await page.getByRole('button', { name: 'Simulate custom rotation' }).click();
  await page.getByText(/custom rotation\)/).waitFor({ timeout: 120_000 });
  await page.screenshot({ path: `${shots}/7-custom.png`, fullPage: true });

  // Weapon comparer
  await page.getByRole('tab', { name: 'Weapon comparer' }).click();
  await page.getByRole('button', { name: 'Pick all' }).click();
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.getByText('Results (sorted by team DPS)').waitFor({ timeout: 180_000 });
  await page.screenshot({ path: `${shots}/8-compare.png`, fullPage: true });
  console.log('compare rows:', (await page.locator('table tbody tr').allInnerTexts()).slice(0, 3).map((t) => t.replace(/\s+/g, ' ')).join(' || '));

  await browser.close();
} finally {
  server.kill();
}
if (errors.length) {
  console.error('BROWSER ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('e2e ok');
