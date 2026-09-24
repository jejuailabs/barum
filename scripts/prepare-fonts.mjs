import {mkdir, readFile, writeFile, copyFile} from 'node:fs/promises';
import path from 'node:path';

// Build artifacts only. Keep font packages and their licenses pinned in package-lock.
const fonts = [
  ['ko', 'node_modules/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css', 'node_modules/pretendard/dist/LICENSE.txt'],
  ['en', 'node_modules/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css', 'node_modules/pretendard/dist/LICENSE.txt'],
  ...[['zh-CN', 'sc'], ['zh-TW', 'tc'], ['ja', 'jp']].map(([locale, suffix]) => [locale, `node_modules/@fontsource-variable/noto-sans-${suffix}/index.css`, `node_modules/@fontsource-variable/noto-sans-${suffix}/LICENSE`])
];
for (const [locale, source, license] of fonts) {
  const output = `public/fonts/${locale}`;
  await mkdir(output, {recursive: true});
  let css = await readFile(source, 'utf8');
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)];
  for (const [, raw] of urls) {
    const relative = raw.replaceAll(/['"]/g, '');
    const file = path.basename(relative);
    await copyFile(path.resolve(path.dirname(source), relative), `${output}/${file}`);
    css = css.replaceAll(raw, `'/fonts/${locale}/${file}'`);
  }
  await writeFile(`${output}/font.css`, css);
  await copyFile(license, `${output}/LICENSE.txt`);
}
const maplibreOutput = 'public/maplibre';
await mkdir(maplibreOutput, {recursive: true});
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await copyFile(`node_modules/maplibre-gl/dist/${file}`, `${maplibreOutput}/${file}`);
}
console.log('Self-hosted unicode-subset fonts and MapLibre worker assets prepared.');
