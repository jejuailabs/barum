import {existsSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const env = {...process.env};
const portable = path.resolve('.tools/java21');
if (process.platform === 'win32' && existsSync(portable)) {
  const folder = readdirSync(portable).find(name => existsSync(path.join(portable, name, 'bin/java.exe')));
  if (folder) {
    const javaBin = path.join(portable, folder, 'bin');
    const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') ?? 'PATH';
    env[pathKey] = `${javaBin}${path.delimiter}${env[pathKey] ?? ''}`;
  }
}
const testing = process.argv[2] === 'test';
const args = ['node_modules/firebase-tools/lib/bin/firebase.js', testing ? 'emulators:exec' : 'emulators:start', '--project', 'demo-barum', '--only', testing ? 'firestore,storage' : 'auth,firestore,storage'];
if (testing) args.push('npx vitest run --config vitest.rules.config.ts');
const result = spawnSync(process.execPath, args, {stdio: 'inherit', env});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
