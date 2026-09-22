import {runInNewContext} from 'node:vm';
import {expect, it} from 'vitest';
import {themeInitScript} from '../../src/lib/theme';

it.each([
  ['light', true, 'light'], ['dark', false, 'dark'], ['system', true, 'dark'],
  ['invalid', false, 'light'], [null, true, 'dark']
])('initializes %s against OS dark=%s before hydration', (stored, dark, expected) => {
  const html = {dataset: {} as Record<string, string>, style: {} as Record<string, string>};
  runInNewContext(themeInitScript, {document: {documentElement: html}, localStorage: {getItem: () => stored}, matchMedia: () => ({matches: dark})});
  expect(html.dataset.theme).toBe(expected);
  expect(html.style.colorScheme).toBe(expected);
});
it('survives blocked browser storage', () => {
  const html = {dataset: {} as Record<string, string>, style: {}};
  runInNewContext(themeInitScript, {document: {documentElement: html}, localStorage: {getItem: () => {throw new Error('blocked');}}, matchMedia: () => ({matches: true})});
  expect(html.dataset.theme).toBe('dark');
});
