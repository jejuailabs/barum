import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const manifest = JSON.parse(await readFile('.next/app-build-manifest.json', 'utf8'));
const app = JSON.parse(await readFile('.next/build-manifest.json', 'utf8'));
const routes = Object.entries(manifest.pages).filter(([name]) => name.endsWith('/page'));
let failed = false;
for (const [route, files] of routes) {
  const unique = new Set([...(app.rootMainFiles ?? []), ...(manifest.pages['/[locale]/layout'] ?? []), ...files]);
  let bytes = 0;
  for (const file of unique) if (file.endsWith('.js')) bytes += gzipSync(await readFile(`.next/${file}`)).byteLength;
  console.log(`${route}: ${(bytes / 1024).toFixed(1)} KiB gzip / 180 KiB budget`);
  if (bytes > 180 * 1024) failed = true;
}
if (!routes.length || failed) process.exit(1);
