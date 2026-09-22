import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

export async function sourceFiles(root = 'src') {
  const entries = await readdir(root, {withFileTypes: true});
  return (await Promise.all(entries.map(async entry => {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(tsx?|css)$/.test(file) ? [{file, text: await readFile(file, 'utf8')}] : [];
  }))).flat();
}
