import {afterEach, beforeEach, expect, it, vi} from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('firebase-admin/app', () => ({getApps: () => [], initializeApp: vi.fn(options => options), cert: vi.fn(options => options)}));
import {initializeApp, cert} from 'firebase-admin/app';
import {getFirebaseAdmin} from '../../src/lib/firebase/admin';

beforeEach(() => {
  vi.clearAllMocks();
  const values = {
    APP_ENV: 'local', NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'false',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'barum-10aad', FIREBASE_PROJECT_ID: 'barum-10aad',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'public-key', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'barum-10aad.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_APP_ID: 'web-app', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    FIREBASE_SERVICE_ACCOUNT_JSON: Buffer.from(JSON.stringify({project_id: 'barum-10aad', client_email: 'test@example.com', private_key: 'test-key'})).toString('base64')
  };
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
  for (const key of ['VERCEL_ENV', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) vi.stubEnv(key, undefined);
});
afterEach(() => vi.unstubAllEnvs());
it('uses a service account for local cloud mode instead of redirecting Admin to demo', () => {
  getFirebaseAdmin();
  expect(cert).toHaveBeenCalledWith(expect.objectContaining({projectId: 'barum-10aad'}));
  expect(initializeApp).toHaveBeenCalledWith(expect.objectContaining({credential: expect.anything()}));
  expect(process.env.FIRESTORE_EMULATOR_HOST).toBeUndefined();
});
it('rejects credentials for another project', () => {
  vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_JSON', Buffer.from(JSON.stringify({project_id: 'other', client_email: 'test@example.com', private_key: 'test-key'})).toString('base64'));
  expect(() => getFirebaseAdmin()).toThrow('credential project mismatch');
  expect(initializeApp).not.toHaveBeenCalled();
});
it('rejects cloud credentials with inherited emulator host settings', () => {
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
  expect(() => getFirebaseAdmin()).toThrow('emulator host overrides');
});
