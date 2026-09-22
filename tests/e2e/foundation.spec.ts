import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ko', 'en', 'zh-CN', 'zh-TW', 'ja']) {
  const prefix = locale === 'ko' ? '' : `/${locale}`;
  test(`${locale} locale roots and gallery render`, async ({page}) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of [`${prefix}/`, `${prefix}/dev/gallery`]) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`@a11y ${theme} home and gallery`, async ({page}, testInfo) => {
    await page.addInitScript(value => localStorage.setItem('barum.theme', value), theme);
    for (const [name, path] of [['home', '/'], ['gallery', '/dev/gallery']]) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.screenshot({path: testInfo.outputPath(`${name}-${theme}.png`), fullPage: true});
      const result = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations).toEqual([]);
    }
  });
  test(`${theme} survives reload and is set before hydration`, async ({page}) => {
    await page.goto('/en');
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

test.describe('browser language detection', () => {
  test.use({locale: 'en-US'});
  test('respects browser preference and explicit URL', async ({page}) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.goto('/ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  });
});
