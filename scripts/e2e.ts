import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

/**
 * Browser smoke test: serves the built app (run `npm run build` first) and drives every tab.
 *   npm run e2e            headless run, screenshots in .cache/shots
 *   E2E_EXECUTABLE=/path/to/chromium npm run e2e   use a specific browser binary
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
  const browser = await chromium.launch(
    process.env.E2E_EXECUTABLE ? { executablePath: process.env.E2E_EXECUTABLE } : { channel: process.env.E2E_CHANNEL ?? 'chrome' },
  );
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  await page.goto(url);
  await page.getByRole('heading', { name: 'Genshin Team Simulator' }).waitFor();
  console.log('loaded:', await page.locator('header p').innerText());

  // Roster
  await page.getByRole('button', { name: 'Own everything' }).click();
  await page.screenshot({ path: `${shots}/1-roster.png`, fullPage: true });

  // Talent input on a phone: tap, type over the old value, and backspace to empty.
  {
    const errorsBefore = errors.length;
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const m = await phone.newPage();
    m.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`));
    await m.goto(url);
    const talent = m.getByLabel('talent 1').first();
    const before = await talent.inputValue();
    await talent.tap();
    await m.waitForTimeout(50);
    await m.keyboard.type('8');
    if (await talent.inputValue() !== '8') errors.push(`mobile talent: typing 8 over ${before} gave ${await talent.inputValue()}`);
    await m.keyboard.press('Backspace');
    if (await talent.inputValue() !== '') errors.push(`mobile talent: backspace gave ${await talent.inputValue()}, expected empty`);
    await m.keyboard.type('12');
    await m.getByRole('heading', { name: 'Genshin Team Simulator' }).tap();
    if (await talent.inputValue() !== '12') errors.push(`mobile talent: typed 12 then blurred, got ${await talent.inputValue()}`);
    await talent.tap();
    await m.waitForTimeout(50);
    await m.keyboard.press('Backspace');
    await m.getByRole('heading', { name: 'Genshin Team Simulator' }).tap();
    if (await talent.inputValue() !== '12') errors.push(`mobile talent: empty then blurred should restore 12, got ${await talent.inputValue()}`);
    if (errors.length === errorsBefore) console.log('mobile talent input: ok');
    await phone.close();
  }

  // Known teams: pick a couple to compare (not a blanket "rank everything").
  await page.getByRole('tab', { name: 'Team comparison' }).click();
  await page.getByRole('heading', { name: /Pick teams/ }).waitFor();
  const teamCheckboxes = page.locator('input[type=checkbox]');
  await teamCheckboxes.nth(0).check();
  await teamCheckboxes.nth(1).check();
  await page.getByRole('button', { name: /Compare selected/ }).click();
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
  await page.getByLabel('team name').fill('E2E team');
  await page.getByRole('button', { name: 'Save team' }).click();
  await page.getByRole('heading', { name: 'Saved teams' }).waitFor();

  // Weapon comparer
  await page.getByRole('tab', { name: 'Weapon comparer' }).click();
  await page.getByLabel('Team', { exact: false }).first().selectOption({ label: 'E2E team (saved)' });
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.getByText('Results (sorted by team DPS)').waitFor({ timeout: 180_000 });
  await page.screenshot({ path: `${shots}/8-compare.png`, fullPage: true });
  console.log('compare rows:', (await page.locator('table tbody tr').allInnerTexts()).slice(0, 3).map((t) => t.replace(/\s+/g, ' ')).join(' || '));

  // Persistence and backup: state survives a reload; a backup restores it in a fresh browser.
  {
    const errorsBefore = errors.length;
    const check = (ok: boolean, msg: string) => { if (!ok) errors.push(`backup: ${msg}`); };
    const ownBox = (p: typeof page, name: string) => p.locator('label', { hasText: name }).locator('input[type=checkbox]').first();

    const ctxA = await browser.newContext();
    const a = await ctxA.newPage();
    a.on('pageerror', (e) => errors.push(`backup pageerror: ${e.message}`));
    await a.goto(url);
    await ownBox(a, 'Hu Tao').check();
    await ownBox(a, 'Xingqiu').check();
    await a.getByLabel('talent 1').first().fill('7');
    await a.getByRole('tab', { name: 'Custom team' }).click();
    for (const n of ['Hu Tao', 'Xingqiu']) await a.getByLabel(n, { exact: true }).check();
    await a.reload();
    check(await a.getByRole('tab', { name: 'Custom team' }).getAttribute('aria-selected') === 'true', 'selected tab not remembered after reload');
    check(await a.getByLabel('Hu Tao', { exact: true }).isChecked(), 'custom team selection not remembered after reload');
    await a.getByRole('tab', { name: 'Roster' }).click();
    check(await ownBox(a, 'Hu Tao').isChecked(), 'owned character not remembered after reload');

    await a.getByRole('tab', { name: 'Backup' }).click();
    const backup = await a.getByLabel('backup text').inputValue();
    check(backup.includes('"hu-tao"') && backup.includes('genshin-team-simulator-backup'), 'export text missing roster');

    const ctxB = await browser.newContext();
    const b = await ctxB.newPage();
    b.on('pageerror', (e) => errors.push(`backup pageerror: ${e.message}`));
    await b.goto(url);
    check(!(await ownBox(b, 'Hu Tao').isChecked()), 'fresh browser should start empty');
    await b.getByRole('tab', { name: 'Backup' }).click();
    await b.getByLabel('import text').fill(backup);
    await b.getByRole('button', { name: 'Import', exact: true }).click();
    const msg = await b.getByRole('status').first().innerText();
    check(/2 owned characters/.test(msg), `import message: ${msg}`);
    await b.getByRole('tab', { name: 'Roster' }).click();
    check(await ownBox(b, 'Hu Tao').isChecked() && await ownBox(b, 'Xingqiu').isChecked(), 'import did not restore owned characters');

    // A stored roster with one invalid entry keeps the valid ones and a recoverable copy.
    await b.evaluate(() => {
      const r = JSON.parse(localStorage.getItem('genshin-sim-roster-v1')!);
      r.characters.keqing = { owned: true, constellation: 99, talents: [1, 1, 1], level: 90 };
      localStorage.setItem('genshin-sim-roster-v1', JSON.stringify(r));
    });
    await b.reload();
    await b.getByRole('tab', { name: 'Roster' }).click();
    check(await ownBox(b, 'Hu Tao').isChecked(), 'one bad entry discarded the whole roster');
    await b.getByRole('tab', { name: 'Backup' }).click();
    check(await b.getByRole('heading', { name: 'Recovered data' }).isVisible(), 'recovered copy not offered');
    await b.screenshot({ path: `${shots}/9-backup.png`, fullPage: true });

    await ctxA.close();
    await ctxB.close();
    if (errors.length === errorsBefore) console.log('persistence and backup: ok');
  }

  await browser.close();
} finally {
  server.kill();
}
if (errors.length) {
  console.error('BROWSER ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('e2e ok');
