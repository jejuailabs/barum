import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const productRoutes = [
  ['map', '/'], ['spot', '/spot/aewol'], ['tide', '/tide/aewol'], ['cctv', '/cctv'], ['travel', '/travel']
] as const;

for (const locale of ['ko', 'en', 'zh-CN', 'zh-TW', 'ja']) {
  const prefix = locale === 'ko' ? '' : `/${locale}`;
  test(`${locale} locale roots and gallery render`, async ({page}) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of [`${prefix}/`, `${prefix}/dev/gallery`]) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('main')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`@a11y ${theme} five product screens`, async ({page}, testInfo) => {
    test.setTimeout(120_000);
    await page.addInitScript(value => localStorage.setItem('barum.theme', value), theme);
    const violations: string[] = [];
    for (const [name, route] of productRoutes) {
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      if (name === 'map' || name === 'spot') {
        await expect(page.locator('.map-loading')).toBeHidden({timeout: 15_000});
      }
      if (testInfo.project.name === 'desktop') await page.screenshot({path: `docs/evidence/phase-1/${name}-${theme}.png`, fullPage: true});
      const result = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      for (const violation of result.violations) violations.push(`${name}: ${violation.id} (${violation.nodes.map(node => node.target.join(' ')).join(', ')})`);
    }
    expect(violations).toEqual([]);
  });
  test(`${theme} survives reload and is set before hydration`, async ({page}) => {
    await page.goto('/en/dev/gallery');
    await page.getByLabel('Theme', {exact: true}).selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.reload();
    await expect(page.getByLabel('Theme', {exact: true})).toHaveValue(theme);
    await page.route('**/_next/**/*.js*', route => route.abort());
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  });
}
test('system preference tracks OS changes and locale switch keeps gallery', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'});
  await page.goto('/en/dev/gallery');
  await page.getByLabel('Theme', {exact: true}).selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({colorScheme: 'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('Language', {exact: true}).selectOption('ja');
  await expect(page).toHaveURL(/\/ja\/dev\/gallery$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
});

test('spot sheet leaves the map interactive', async ({page}, testInfo) => {
  await page.goto('/spot/aewol');
  const map = page.locator('[data-map-interactive]');
  await expect(map).toBeVisible();
  await expect(page.locator('.bottom-sheet')).toHaveAttribute('data-snap', '55');
  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.map-loading')).toBeHidden({timeout: 15_000});
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Map bounds unavailable');
  if (testInfo.project.name === 'mobile') {
    await canvas.dispatchEvent('pointerdown', {pointerId: 1, pointerType: 'touch', buttons: 1, clientX: box.x + 80, clientY: box.y + 140});
    await canvas.dispatchEvent('pointermove', {pointerId: 1, pointerType: 'touch', buttons: 1, clientX: box.x + 150, clientY: box.y + 180});
    await canvas.dispatchEvent('pointerup', {pointerId: 1, pointerType: 'touch', buttons: 0, clientX: box.x + 150, clientY: box.y + 180});
  } else {
    await page.mouse.move(box.x + box.width * .35, box.y + Math.min(150, box.height * .2));
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .55, box.y + Math.min(190, box.height * .25), {steps: 8});
    await page.mouse.up();
  }
  await expect(map).toHaveAttribute('data-map-moved', 'true');
});

test('map click refreshes the displayed point from the live BFF', async ({page}) => {
  const initialResponse = page.waitForResponse(response => response.url().includes('/api/v1/point?') && response.status() === 200);
  await page.goto('/');
  const first = await initialResponse;
  const firstPayload = await first.json();
  expect(firstPayload.data.point.meta.source).not.toContain('MOCK');
  await expect(page.locator('.mock-flag')).toHaveAttribute('data-live-loading', 'false');
  await expect(page.locator('.mock-flag')).toContainText(/실시간/);
  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Map bounds unavailable');
  const nextResponse = page.waitForResponse(response => response.url().includes('/api/v1/point?') && response.status() === 200);
  await canvas.click({position: {x: box.width * .63, y: box.height * .42}});
  const next = await nextResponse;
  expect(new URL(next.url()).searchParams.get('lat')).not.toBe('33.4621');
  const nextPayload = await next.json();
  expect(nextPayload.data.point.meta.source).not.toContain('MOCK');
});

test('tablet product screens do not overflow', async ({page}) => {
  await page.setViewportSize({width: 900, height: 1100});
  for (const [, route] of productRoutes) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('grid layers switch and timeline publishes a shareable time', async ({page}) => {
  test.setTimeout(60_000);
  await page.route('https://tiles.openfreemap.org/styles/**', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({version: 8, sources: {}, layers: []})}));
  await page.route('**/api/v1/point?**', route => route.abort());
  await page.route('**/api/v1/forecast/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.map-loading')).toBeHidden({timeout: 15_000});
  await expect(page.locator('.grid-source')).toContainText(/NOAA GFS 0.25° 예보|격자 렌더러 검증용 예시 필드/);
  await expect(page.locator('.weather-canvas')).toBeVisible();
  await page.getByRole('radio', {name: '강수'}).click();
  await expect(page.getByRole('radio', {name: '강수'})).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.grid-source strong')).toHaveText('강수');
  await page.locator('#weather-time').fill('50');
  await expect.poll(() => new URL(page.url()).searchParams.has('at')).toBe(true);
});

test('CCTV registry exposes ten attributed cameras and detail view', async ({page}) => {
  await page.goto('/cctv');
  const cameras = page.locator('.nearby-grid > button');
  await expect(cameras).toHaveCount(10);
  await expect(cameras.first()).toContainText('출처: 제주특별자치도');
  await expect(page.getByRole('link', {name: /제공기관 페이지/})).toBeVisible();
  await page.getByRole('link', {name: /상세 보기/}).click();
  await expect(page).toHaveURL(/\/cctv\/hyeopjae$/);
  await expect(page.locator('.cctv-player-detail')).toBeVisible();
});

test.describe('browser language detection', () => {
  test.use({locale: 'en-US'});
  test('respects browser preference and explicit URL', async ({page}) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.goto('/ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  });
});
