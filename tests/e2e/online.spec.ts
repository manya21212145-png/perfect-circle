// Business testing scenarios that need the PC server: daily, login and sync, duels.
import { expect, test, type Page } from '@playwright/test';
import { drawShape, settle } from './helpers';

async function login(page: Page, nick: string, pin = '2468') {
  await page.goto('/#/profile');
  await page.getByLabel('Nickname').fill(nick);
  await page.getByLabel('PIN').fill(pin);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(`Signed in as`)).toBeVisible();
}

async function setDate(page: Page, date: string) {
  await page.goto('/#/settings');
  await page.getByLabel('Date override').fill(date);
  await page.getByRole('button', { name: 'Use this date' }).click();
}

/** Plays today's daily (whatever the shape) and waits for the score. */
async function playDaily(page: Page) {
  await page.goto('/#/daily');
  const heading = await page.locator('.daily-card h2').innerText();
  const shape = (['circle', 'square', 'triangle', 'star'] as const).find((s) => heading.toLowerCase().includes(s))!;
  await page.goto('/#/play?daily=1');
  await settle(page);
  for (let i = 0; i < 3; i++) {                        // moving/timed modes can reject: retry
    await drawShape(page, shape, { steps: 45, scale: shape === 'star' ? 1.25 : 1 });
    const ok = await page.locator('.readout .score').innerText().then((t) => t.endsWith('%')).catch(() => false);
    await page.waitForTimeout(300);
    if (ok && (await page.locator('.readout .score').innerText()).endsWith('%')) return shape;
    await page.getByRole('button', { name: /Retry|Practice/ }).click();
  }
  return shape;
}

test('BT-14 two devices open the daily challenge: same number, shape and mode', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await a.goto('/#/daily');
  await b.goto('/#/daily');
  await expect(a.locator('.topbar h1')).toHaveText(await b.locator('.topbar h1').innerText());
  await expect(a.locator('.daily-card h2')).toHaveText(await b.locator('.daily-card h2').innerText());
});

test('BT-15, BT-16 daily twice: second try is practice; share text has number, score and 5 squares', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await playDaily(page);
  await page.goto('/#/daily');
  await expect(page.locator('.big-score')).toHaveText(/%$/);
  const first = await page.locator('.big-score').innerText();

  await page.getByRole('link', { name: 'Practice (not counted)' }).click();
  await expect(page.locator('.mode-tag')).toContainText('Practice');
  await settle(page);
  await drawShape(page, 'circle');
  await page.goto('/#/daily');
  await expect(page.locator('.big-score')).toHaveText(first); // unchanged

  await page.evaluate(() => { (navigator as { share?: unknown }).share = undefined; });
  await page.getByRole('button', { name: 'Share result' }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/^Perfect Circle #\d+  \w+, .+\n\d{1,3}\.\d%  (🟩|🟨|🟥){5}\nStreak: \d+ days?$/u);
});

test('BT-17 dailies on 3 days (date override), then a skipped day: streak 3, then 0; best stays 3', async ({ page }) => {
  for (const d of ['2027-01-01', '2027-01-02', '2027-01-03']) {
    await setDate(page, d);
    await playDaily(page);
  }
  await page.goto('/#/profile');
  await expect(page.locator('.stat', { hasText: 'day streak' }).locator('strong')).toHaveText('3');
  await setDate(page, '2027-01-05');
  await page.goto('/#/profile');
  await expect(page.locator('.stat', { hasText: 'day streak' }).locator('strong')).toHaveText('0');
  await expect(page.locator('.stat', { hasText: 'best streak' }).locator('strong')).toHaveText('3');
});

test('BT-20 log in on a phone, play, then log in on a laptop: same history and badges', async ({ browser }) => {
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  await login(phone, 'asha_bt20');
  for (let i = 0; i < 3; i++) {
    await phone.goto('/#/play?shape=circle&mode=classic&off=0');
    await settle(phone);
    await drawShape(phone, 'circle');
    await expect(phone.locator('.readout .score')).toHaveText(/%$/);
  }
  await phone.goto('/#/profile');
  await phone.getByRole('button', { name: 'Sync now' }).click();
  await expect(phone.locator('.stat', { hasText: 'attempts' }).locator('strong')).toHaveText('3');

  const laptop = await (await browser.newContext()).newPage();
  await login(laptop, 'asha_bt20');
  await expect(laptop.locator('.stat', { hasText: 'attempts' }).locator('strong')).toHaveText('3');
  await expect(laptop.locator('.badge.earned', { hasText: 'First circle' })).toBeVisible();

  const wrong = await (await browser.newContext()).newPage();
  await wrong.goto('/#/profile');
  await wrong.getByLabel('Nickname').fill('asha_bt20');
  await wrong.getByLabel('PIN').fill('0000');
  await wrong.getByRole('button', { name: 'Sign in' }).click();
  await expect(wrong.getByText('Wrong PIN for this nickname')).toBeVisible();
});

test('BT-08, BT-10, BT-30 two phones duel: see each other in 3 s, same shape, synced countdown, same final result; no PIN shown', async ({ browser }) => {
  const opts = { viewport: { width: 412, height: 915 }, hasTouch: true };
  const a = await (await browser.newContext(opts)).newPage();
  const b = await (await browser.newContext(opts)).newPage();
  await login(a, 'host_bt08', '1357');

  await a.goto('/#/duel');
  await a.getByRole('button', { name: 'Create room' }).click();
  const code = (await a.locator('.room-code').innerText()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  await expect(a.locator('canvas.qr')).toBeVisible();

  await b.goto('/#/duel');
  await b.getByLabel('Your nickname').fill('guest_bt08');
  await b.getByLabel('Room code').fill(code);
  const t0 = Date.now();
  await b.getByRole('button', { name: 'Join room' }).click();
  await expect(a.locator('.players')).toContainText('guest_bt08', { timeout: 3000 });
  await expect(b.locator('.players')).toContainText('host_bt08', { timeout: 3000 });
  expect(Date.now() - t0).toBeLessThan(3000);
  expect(await a.content()).not.toContain('1357'); // BT-30: no PIN anywhere

  await a.getByRole('button', { name: 'Ready' }).click();
  await b.getByRole('button', { name: 'Ready' }).click();

  for (let round = 1; round <= 3; round++) {
    await expect(a.locator('.countdown')).toContainText(`Round ${round}`, { timeout: 12_000 });
    const labelA = await a.locator('.round-label').innerText();
    const labelB = await b.locator('.round-label').innerText();
    expect(labelA).toBe(labelB); // same shape and mode on both phones
    const shape = (['circle', 'square', 'triangle', 'star'] as const).find((s) => labelA.toLowerCase().includes(s))!;
    await expect(a.locator('.countdown')).toContainText('Draw!', { timeout: 5000 });
    await Promise.all([
      drawShape(a, shape, { top: 64, steps: 40, scale: shape === 'star' ? 1.25 : 1 }),
      drawShape(b, shape, { top: 64, steps: 40, scale: 0.8 }),
    ]);
    await expect(a.locator('.sheet h2')).toContainText(/round|duel/, { timeout: 25_000 });
    await a.waitForTimeout(500);
    if (/duel/.test(await a.locator('.sheet h2').innerText())) break;
  }
  await expect(a.locator('.sheet h2')).toContainText('duel', { timeout: 30_000 });
  await expect(b.locator('.sheet h2')).toContainText('duel', { timeout: 5000 });
  const finalA = await a.locator('.sheet .muted').last().innerText();
  const finalB = await b.locator('.sheet .muted').last().innerText();
  const nums = (t: string) => t.match(/\d+/g)!.map(Number);
  expect(nums(finalA)).toEqual(nums(finalB).reverse()); // same result, from each side
});

test('BT-11 one player drops out mid-duel: the other wins after 15 s with a clear message', async ({ browser }) => {
  test.setTimeout(90_000);
  const a = await (await browser.newContext()).newPage();
  const bCtx = await browser.newContext();
  const b = await bCtx.newPage();
  await a.goto('/#/duel');
  await a.getByLabel('Your nickname').fill('stay_bt11');
  await a.getByRole('button', { name: 'Create room' }).click();
  const code = (await a.locator('.room-code').innerText()).trim();
  await b.goto('/#/duel');
  await b.getByLabel('Your nickname').fill('leave_bt11');
  await b.getByLabel('Room code').fill(code);
  await b.getByRole('button', { name: 'Join room' }).click();
  await a.getByRole('button', { name: 'Ready' }).click();
  await b.getByRole('button', { name: 'Ready' }).click();
  await expect(a.locator('.countdown')).toContainText('Round 1', { timeout: 10_000 });
  await bCtx.close(); // "turns off Wi-Fi"
  await expect(a.locator('.banner')).toContainText('lost connection', { timeout: 5000 });
  await expect(a.getByText('leave_bt11 left the duel, so you win.')).toBeVisible({ timeout: 25_000 });
});

test('BT-12 split screen on a tablet: two players draw at once, scored separately', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true })).newPage();
  await page.goto('/#/split');
  await expect(page.getByRole('button', { name: 'Draw together' })).toBeVisible();
  const label = await page.locator('.countdown').innerText();
  const shape = (['circle', 'square', 'triangle', 'star'] as const).find((s) => label.toLowerCase().includes(s))!;
  await expect(page.locator('.countdown')).toContainText('Draw!', { timeout: 5000 });
  await drawShape(page, shape, { cx: 256, steps: 40, scale: 0.5 });
  await drawShape(page, shape, { cx: 768, steps: 40, scale: 0.45 });
  await expect(page.locator('.split-label.left')).toContainText('Player 1 —');
  await expect(page.locator('.split-label.right')).toContainText('Player 2 —');
  await expect(page.getByRole('heading', { name: /wins/ })).toBeVisible({ timeout: 12_000 });
});

test('BT-13 laptop with a mouse: players take turns; higher score wins', async ({ page }) => {
  await page.goto('/#/split');
  await expect(page.getByRole('button', { name: 'Take turns' })).toBeVisible();
  await expect(page.locator('.countdown')).toContainText('Player 1 first');
  const label = await page.locator('.countdown').innerText();
  const shape = (['circle', 'square', 'triangle', 'star'] as const).find((s) => label.toLowerCase().includes(s))!;
  const vp = page.viewportSize()!;
  await expect(page.locator('.countdown')).toContainText('Draw!', { timeout: 5000 });
  await drawShape(page, shape, { cx: vp.width / 4, steps: 40, scale: 0.5 });
  await expect(page.locator('.countdown')).toContainText("Player 2's turn");
  await expect(page.locator('.countdown')).toContainText('Draw!', { timeout: 5000 });
  await drawShape(page, shape, { cx: (3 * vp.width) / 4, steps: 40, scale: 0.5 });
  await expect(page.getByRole('heading', { name: /wins/ })).toBeVisible({ timeout: 12_000 });
});
