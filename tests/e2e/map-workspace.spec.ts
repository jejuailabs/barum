import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {getPhaseOneData} from '../../src/lib/sources/mock';

test.beforeEach(async ({page}) => {
  // Existing adapter fixtures isolate UI tests from upstream API availability.
  const fixture = getPhaseOneData();
  await page.route('**/api/v1/point?**', route => route.fulfill({json:{data:{point:fixture.point, marine:fixture.marine}}}));
  await page.route('**/api/v1/forecast/hourly?**', route => route.fulfill({json:{data:fixture.hourly, meta:{...fixture.point.meta, source:'KMA_ULTRA_FCST', sourceLabelKey:'sources.kmaUltraForecast', issuedAt:'2026-09-23T12:30:00+09:00'}}}));
  await page.route('**/api/v1/forecast/daily?**', route => route.fulfill({json:{data:fixture.daily}}));
});

for (const theme of ['dark', 'light']) {
  test(`map workspace ${theme}: controls, local forecast and CCTV`, async ({page}, testInfo) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('barum.theme', value), theme);
    await page.goto('/');
    await expect(page.locator('.map-loading')).toBeHidden({timeout:30_000});
    await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-variable', 'wind');
    await expect(page.locator('[data-renderer="gpu-raster"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const canvas = page.locator('.maplibregl-canvas');
    const bounds = await canvas.boundingBox();
    expect(bounds?.x).toBe(0);
    await page.screenshot({path:`test-results/map-${testInfo.project.name}-${theme}.png`});
    const accessibility = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(accessibility.violations.map(item => ({id:item.id, targets:item.nodes.map(node => node.target)}))).toEqual([]);
    await page.getByRole('button', {name:'초단기예보', exact:true}).click();
    await expect(page.locator('.map-home .bottom-sheet')).toBeVisible();
    await expect(page.locator('.map-forecast-sources')).toContainText('기상청 초단기예보');
    await page.screenshot({path:`test-results/map-forecast-${testInfo.project.name}-${theme}.png`});
    await page.getByRole('button', {name:'닫기', exact:true}).click();
    await page.locator('.map-extras').getByRole('button', {name:'CCTV', exact:true}).click();
    await expect(page.locator('.map-camera-marker')).toHaveCount(10);
    await page.locator('.map-camera-marker').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.map-home .cctv-player')).toBeVisible();
    await page.getByRole('button', {name:'닫기', exact:true}).click();
    await page.locator('.map-extras').getByRole('button', {name:'CCTV', exact:true}).click();
    await expect(page.locator('.map-camera-marker')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('timeline keeps its time across layer changes, caches frames and restores links', async ({page}) => {
  test.setTimeout(90_000);
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/v1/grid/')) requests.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-variable', 'wind');
  await page.locator('#weather-time').fill('50');
  await expect.poll(() => new URL(page.url()).searchParams.has('at')).toBe(true);
  const selected = new URL(page.url()).searchParams.get('at');
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-time', selected!);
  await page.getByRole('radio', {name:'기온', exact:true}).click();
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-variable', 'temp');
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-state', 'ready');
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-time', selected!);
  await expect(page.locator('#weather-time')).toHaveValue('50');
  expect(new URL(page.url()).searchParams.get('at')).toBe(selected);
  const before = requests.length;
  await page.locator('#weather-time').fill('50.5');
  const next = new URL(page.url()).searchParams.get('at');
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-time', next!);
  expect(requests.length).toBe(before);
  await page.reload();
  await expect(page.locator('#weather-time')).toHaveValue('50.5');
});

test('missing precipitation grid hides the color field and explains why', async ({page}, testInfo) => {
  await page.route('**/api/v1/grid/rain?**', route => route.fulfill({status:503, json:{data:null, error:{code:'GRID_UNAVAILABLE'}}}));
  await page.goto('/');
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-state', 'ready');
  await page.getByRole('radio', {name:'강수', exact:true}).click();
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-state', 'unavailable');
  await expect(page.locator('.grid-source')).toContainText('실제 강수 예보 격자가 없어');
  await expect(page.locator('.weather-overlay')).toHaveAttribute('data-field-visible', 'false');
  await expect(page.locator('.map-loading')).toBeHidden({timeout:30_000});
  await page.screenshot({path:`test-results/map-rain-unavailable-${testInfo.project.name}.png`});
  await page.getByRole('radio', {name:'바람', exact:true}).click();
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-state', 'ready');
  await expect(page.locator('.weather-overlay')).toHaveAttribute('data-field-visible', 'true');
});

test('panning keeps the weather field without rasterizing or refetching it', async ({page}, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const OriginalImageData = window.ImageData;
    Object.assign(window, {fieldRasterCount:0});
    window.ImageData = new Proxy(OriginalImageData, {construct(target, args) {
      const metrics = window as unknown as {fieldRasterCount:number};
      metrics.fieldRasterCount++;
      return Reflect.construct(target, args);
    }});
  });
  await page.goto('/');
  await expect(page.locator('.map-loading')).toBeHidden({timeout:30_000});
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-variable', 'wind');
  await page.locator('#weather-time').fill('50');
  await expect.poll(() => new URL(page.url()).searchParams.has('at')).toBe(true);
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-time', new URL(page.url()).searchParams.get('at')!);
  const count = () => page.evaluate(() => (window as unknown as {fieldRasterCount:number}).fieldRasterCount);
  await expect.poll(count).toBeGreaterThan(0);
  const before = await count();
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  if (!box) throw new Error('Missing map canvas');
  await page.mouse.move(box.width * .45, box.height * .45);
  await page.mouse.down();
  await page.mouse.move(box.width * .62, box.height * .48, {steps:24});
  await page.mouse.up();
  await expect(page.locator('[data-map-moved]')).toHaveAttribute('data-map-moved', 'true');
  expect(await count()).toBe(before);
  await page.screenshot({path:`test-results/map-pan-${testInfo.project.name}.png`});
});

test('desktop frame timing sample', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop performance sample');
  await page.goto('/');
  await expect(page.locator('.map-loading')).toBeHidden({timeout:30_000});
  await expect(page.locator('.grid-source')).toHaveAttribute('data-grid-variable', 'wind');
  const sample = () => page.evaluate(() => new Promise<{fps:number; p95Ms:number; frames:number}>(resolve => {
    const deltas: number[] = [];
    let previous = 0;
    const tick = (now: number) => {
      if (previous) deltas.push(now - previous);
      previous = now;
      if (deltas.length < 120) { requestAnimationFrame(tick); return; }
      const mean = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
      deltas.sort((a, b) => a - b);
      resolve({fps:Math.round(1000 / mean), p95Ms:Math.round(deltas[Math.floor(deltas.length * .95)] * 10) / 10, frames:deltas.length});
    };
    requestAnimationFrame(tick);
  }));
  const idle = await sample();
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  if (!box) throw new Error('Missing map bounds');
  const pan = sample();
  await page.mouse.move(box.width * .4, box.height * .4);
  await page.mouse.down();
  for (let index = 0; index < 6; index++) await page.mouse.move(box.width * (index % 2 ? .4 : .65), box.height * .45, {steps:30});
  await page.mouse.up();
  const result = {viewport:page.viewportSize(), idle, pan:await pan};
  await testInfo.attach('frame-timing', {body:JSON.stringify(result, null, 2), contentType:'application/json'});
  console.log('Frame timing sample:', JSON.stringify(result));
});

test('large desktop limits the animated canvas pixel budget', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop canvas budget');
  test.setTimeout(90_000);
  await page.setViewportSize({width:3840, height:2160});
  await page.goto('/');
  await expect(page.locator('.map-loading')).toBeHidden({timeout:30_000});
  await expect(page.locator('[data-renderer="gpu-raster"]')).toBeVisible();
  const canvas = page.locator('.weather-flow-canvas');
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).width * (element as HTMLCanvasElement).height)).toBeGreaterThan(2_900_000);
  const pixels = await canvas.evaluate(element => (element as HTMLCanvasElement).width * (element as HTMLCanvasElement).height);
  expect(pixels).toBeLessThanOrEqual(3_002_000);
  await testInfo.attach('large-desktop-canvas-budget', {body:JSON.stringify({viewport:page.viewportSize(), pixels}), contentType:'application/json'});
});
