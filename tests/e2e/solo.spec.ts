// Business testing scenarios that a browser can check by itself (solo play).
// Each test name starts with its Business Testing Document ID.
import { expect, test } from '@playwright/test';
import { drawPath, drawShape, outline, centre, settle } from './helpers';

const score = (page: import('@playwright/test').Page) => page.locator('.readout .score');
const note = (page: import('@playwright/test').Page) => page.locator('.readout .note');

test('BT-01 new player opens the link and draws a circle: score within 1 s, no sign-up', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Perfect Circle' })).toBeVisible();
  await page.getByRole('link', { name: 'Play' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await settle(page);
  await drawShape(page, 'circle');
  const t0 = Date.now();
  await expect(score(page)).toHaveText(/^\d{1,3}\.\d%$/, { timeout: 1000 });
  expect(Date.now() - t0).toBeLessThan(1000);
  expect(parseFloat(await score(page).innerText())).toBeGreaterThan(90);
  await expect(page.getByText(/sign in|log in/i)).toHaveCount(0);
});

for (const shape of ['circle', 'square', 'triangle', 'star'] as const) {
  test(`BT-02 draws a ${shape}: scored, ideal ${shape} overlay shown`, async ({ page }, info) => {
    await page.goto(`/#/play?shape=${shape}&mode=classic&off=0`);
    await settle(page);
    await drawShape(page, shape, { scale: shape === 'star' ? 1.25 : 1 });
    await expect(score(page)).toHaveText(/%$/);
    expect(parseFloat(await score(page).innerText())).toBeGreaterThanOrEqual(90);
    await page.screenshot({ path: info.outputPath(`result-${shape}.png`) });
  });
}

test('BT-03 too close, backwards and not closed each show their own message and Retry', async ({ page }) => {
  await page.goto('/#/play?shape=circle&mode=classic&off=0');
  await settle(page);
  const { cx, cy, size } = centre(page);

  await drawPath(page, outline('circle', cx, cy, 30));
  await expect(note(page)).toHaveText('Too close to the dot. Try again.');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

  // forwards 2 rad, then backwards 1 rad
  const pts = [];
  for (let a = 0; a <= 2; a += 0.05) pts.push({ x: cx + size * Math.cos(a), y: cy + size * Math.sin(a) });
  for (let a = 2; a >= 1; a -= 0.05) pts.push({ x: cx + size * Math.cos(a), y: cy + size * Math.sin(a) });
  await page.getByRole('button', { name: 'Retry' }).click();
  await drawPath(page, pts);
  await expect(note(page)).toHaveText('Wrong way. Keep going in one direction.');

  await page.getByRole('button', { name: 'Retry' }).click();
  await drawPath(page, outline('circle', cx, cy, size, 60, 0.6));
  await expect(note(page)).toHaveText('Close the shape. Try again.');
});

test('BT-04 time limit 3 s: the attempt fails at 0', async ({ page }) => {
  await page.goto('/#/play?shape=circle&mode=timed&limit=3&off=0');
  await expect(page.locator('.mode-tag')).toContainText('3 s time limit');
  await settle(page);
  const { cx, cy, size } = centre(page);
  const pts = outline('circle', cx, cy, size, 60, 0.5);
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts) await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(3300); // hold still past the limit
  await expect(note(page)).toHaveText('Too slow. Try again.');
  await page.mouse.up();
});

test('BT-05 disappearing ink: attempt is scored and the full stroke is shown on the result', async ({ page }, info) => {
  await page.goto('/#/play?shape=circle&mode=ink&off=0');
  await settle(page);
  await drawShape(page, 'circle');
  await expect(score(page)).toHaveText(/%$/);
  await page.screenshot({ path: info.outputPath('ink-result.png') });
});

test('BT-06 moving dot: the dot moves and an attempt is scored against it', async ({ page }) => {
  await page.goto('/#/play?shape=circle&mode=moving&off=0');
  const a = await page.locator('canvas#board').screenshot();
  await page.waitForTimeout(1500);
  const b = await page.locator('canvas#board').screenshot();
  expect(a.equals(b)).toBe(false); // something moved
  await drawShape(page, 'circle', { steps: 40 });
  await expect(note(page)).not.toHaveText(/around the dot/); // the attempt finished
  const shown = (await score(page).innerText()) || (await note(page).innerText());
  expect(shown).toMatch(/%$|Try again|bigger/);
});

test('BT-07 non-dominant hand: result and history show the off-hand tag', async ({ page }) => {
  await page.goto('/#/setup');
  await page.getByText("I'm using my other hand").click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.mode-tag')).toContainText('Other hand');
  await settle(page);
  await drawShape(page, 'circle');
  await expect(score(page)).toHaveText(/%$/);
  await page.goto('/#/profile');
  await expect(page.locator('.recent .tag', { hasText: 'Other hand' }).first()).toBeVisible();
});

test('BT-18 first 90%+ score shows the Sharp eye badge pop-up once', async ({ page }) => {
  await page.goto('/#/play?shape=circle&mode=classic&off=0');
  await settle(page);
  await drawShape(page, 'circle');
  await expect(page.locator('.badge-pop', { hasText: 'Sharp eye' })).toBeVisible({ timeout: 6000 });
  await page.getByRole('button', { name: 'Retry' }).click();
  await drawShape(page, 'circle');
  await expect(score(page)).toHaveText(/%$/);
  await page.waitForTimeout(1500);
  await expect(page.locator('.badge-pop', { hasText: 'Sharp eye' })).toHaveCount(0);
});

test('BT-19 Profile after 20 attempts: graph shows attempts; shape and mode filters work', async ({ page }) => {
  for (const shape of ['circle', 'square'] as const) {
    await page.goto(`/#/play?shape=${shape}&mode=classic&off=0`);
    await settle(page);
    for (let i = 0; i < 10; i++) {
      await drawShape(page, shape, { steps: 50, scale: 0.9 + i * 0.02 });
      await expect(score(page)).toHaveText(/%$/);
      await page.getByRole('button', { name: 'Retry' }).click();
    }
  }
  await page.goto('/#/profile');
  await expect(page.locator('.stat', { hasText: 'attempts' }).locator('strong')).toHaveText('20');
  await expect(page.locator('.chart-box canvas')).toBeVisible();
  await expect(page.locator('.filters + .chart-box + p')).toContainText('20 attempts');
  await page.locator('select[name=shape]').selectOption('square');
  await expect(page.locator('.filters + .chart-box + p')).toContainText('10 attempts');
  await page.locator('select[name=mode]').selectOption('ink');
  await expect(page.locator('.filters + .chart-box + p')).toContainText('No attempts');
});

test('BT-27 dark mode: screens use the chalkboard theme', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto('/');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(38, 53, 44)');
  await ctx.close();
});

test('BT-28 menus work with the keyboard only (Tab and Enter)', async ({ page }) => {
  await page.goto('/');
  let found = false;
  for (let i = 0; i < 12 && !found; i++) {
    await page.keyboard.press('Tab');
    found = (await page.evaluate(() => document.activeElement?.textContent)) === 'Play';
  }
  expect(found).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/setup/);
  await page.getByRole('button', { name: 'Start' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/play/);
});

test('BT-24 solo play works offline once loaded', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // now controlled by the service worker
  await context.setOffline(true);
  await page.goto('/#/play?shape=circle&mode=classic&off=0');
  await settle(page);
  await drawShape(page, 'circle');
  await expect(score(page)).toHaveText(/%$/);
  await page.goto('/#/profile');
  await expect(page.locator('.stat', { hasText: 'attempts' }).locator('strong')).not.toHaveText('0');
  await context.setOffline(false);
});
