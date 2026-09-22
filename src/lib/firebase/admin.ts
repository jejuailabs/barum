import 'server-only';
import {cert, getApps, initializeApp} from 'firebase-admin/app';
import {z} from 'zod';
import {parseEnv} from '../../env';

/** Create the Admin SDK only in server Node.js features that need it. */
export function getFirebaseAdmin() {
  const existing = getApps()[0];
  if (existing) return existing;
  const env = parseEnv(process.env);
  if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
    return initializeApp({projectId: 'demo-barum'});
  }
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    throw new Error('Cloud Firebase must not have emulator host overrides');
  }
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8')); }
  catch { throw new Error('Invalid Firebase server credential'); }
  const result = z.object({project_id: z.string(), client_email: z.email(), private_key: z.string().min(1)}).safeParse(decoded);
  if (!result.success || result.data.project_id !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw new Error('Firebase server credential project mismatch');
  return initializeApp({credential: cert({projectId: result.data.project_id, clientEmail: result.data.client_email, privateKey: result.data.private_key})});
}
