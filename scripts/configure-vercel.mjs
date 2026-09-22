import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

// Explicit provisioning step for the linked Barum project. Public web configuration only.
const vercelCli = process.argv[2];
if (!vercelCli) throw new Error('Pass the installed Vercel CLI JavaScript entry path');
const linked = JSON.parse(await readFile('.vercel/project.json', 'utf8'));
if (linked.projectName !== 'barum') throw new Error('Expected the linked barum project');
const apps = {
  preview: ['barum-staging', '1:1047981786467:web:dbb9805700eff11bf27f56'],
  production: ['barum-prod', '1:238520446288:web:e46ee54300ebdf94765055']
};
for (const [target, [project, app]] of Object.entries(apps)) {
  const result = spawnSync(process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js', 'apps:sdkconfig', 'WEB', app, '--project', project, '--json'], {encoding: 'utf8'});
  if (result.status !== 0) throw new Error(`Firebase public config lookup failed for ${project}`);
  const config = JSON.parse(result.stdout).result.sdkConfig;
  const values = {
    APP_ENV: target,
    NEXT_PUBLIC_SITE_URL: 'https://barum-funjejus-projects.vercel.app',
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'false',
    NEXT_PUBLIC_FIREBASE_API_KEY: config.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: config.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: config.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: config.appId,
    FIREBASE_STAGING_PROJECT_ID: 'barum-staging',
    FIREBASE_PRODUCTION_PROJECT_ID: 'barum-prod'
  };
  for (const [name, value] of Object.entries(values)) {
    if (typeof value !== 'string' || !value) throw new Error(`Missing ${name}`);
    const added = spawnSync(process.execPath, [vercelCli, 'env', 'add', name, target, '--force'], {input: value, encoding: 'utf8'});
    if (added.status !== 0) throw new Error(`Vercel environment setup failed: ${target}/${name}: ${added.stderr}`);
    console.log(`Configured ${target}/${name}`);
  }
}
