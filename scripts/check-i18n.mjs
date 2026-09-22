import {readFile} from 'node:fs/promises';
import {sourceFiles} from './files.mjs';
import {parse} from '@formatjs/icu-messageformat-parser';

const locales = ['ko', 'en', 'zh-CN', 'zh-TW', 'ja'];
function flatten(value, prefix = '') {
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') return [[full, child]];
    if (child && typeof child === 'object' && !Array.isArray(child)) return Object.entries(flatten(child, full));
    throw new Error(`Message must be a string or namespace: ${full}`);
  }));
}
function parameters(text) {
  const args = new Set();
  function walk(nodes) {
    for (const node of nodes) {
      if (node.type !== 0 && node.type !== 7 && 'value' in node) args.add(node.value);
      if ('options' in node) for (const option of Object.values(node.options)) walk(option.value);
      if ('children' in node) walk(node.children);
    }
  }
  walk(parse(text));
  return [...args].sort().join(',');
}
const messages = await Promise.all(locales.map(async locale => flatten(JSON.parse(await readFile(`messages/${locale}.json`, 'utf8')))));
const reference = messages[0];
const errors = [];
for (const [index, map] of messages.entries()) {
  for (const key of new Set([...Object.keys(reference), ...Object.keys(map)])) {
    if (!(key in map) || !(key in reference)) errors.push(`${locales[index]}: key mismatch ${key}`);
    else {
      if (!map[key].trim()) errors.push(`${locales[index]}: empty ${key}`);
      try { if (parameters(map[key]) !== parameters(reference[key])) errors.push(`${locales[index]}: parameter mismatch ${key}`); }
      catch { errors.push(`${locales[index]}: invalid ICU ${key}`); }
    }
  }
}
const used = new Set();
for (const {text} of await sourceFiles()) {
  for (const match of text.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(['"]([^'"]+)['"]\)/g)) {
    const [, variable, namespace] = match;
    const calls = new RegExp(`\\b${variable}\\(['"]([^'"]+)['"]`, 'g');
    for (const call of text.matchAll(calls)) used.add(`${namespace}.${call[1]}`);
  }
  for (const key of ['name', 'description']) if (text.includes("namespace: 'app'")) used.add(`app.${key}`);
}
// Only these keys are intentionally reached through typed iteration in the gallery/switcher.
for (const locale of locales) used.add(`language.${locale}`);
for (const layer of ['wind', 'temp', 'rain', 'wave']) used.add(`gallery.${layer}`);
for (const key of Object.keys(reference)) if (!used.has(key)) errors.push(`Unused key: ${key}`);
for (const key of used) if (!(key in reference)) errors.push(`Unknown key: ${key}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`${locales.length} locales: ${Object.keys(reference).length} keys; ICU parameters and usage valid.`);
