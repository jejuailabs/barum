import {describe, expect, it} from 'vitest';
import {parseEnv} from '../../src/env';

const preview = {
  APP_ENV: 'preview', VERCEL_ENV: 'preview', NEXT_PUBLIC_SITE_URL: 'https://barum.example',
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'false', NEXT_PUBLIC_FIREBASE_API_KEY: 'public-web-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'barum-staging.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'barum-staging', NEXT_PUBLIC_FIREBASE_APP_ID: 'web-app',
  FIREBASE_STAGING_PROJECT_ID: 'barum-staging', FIREBASE_PRODUCTION_PROJECT_ID: 'barum-prod'
};
describe('environment boundary', () => {
  it('starts local without production credentials', () => expect(parseEnv({}).APP_ENV).toBe('local'));
  it('accepts staging credentials in preview', () => expect(parseEnv(preview).APP_ENV).toBe('preview'));
  it('blocks preview from pointing to production', () => expect(() => parseEnv({...preview, NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'barum-prod'})).toThrow('does not match'));
  it('requires distinct environments', () => expect(() => parseEnv({...preview, FIREBASE_PRODUCTION_PROJECT_ID: 'barum-staging'})).toThrow('distinct'));
  it('blocks deployed emulator configuration', () => expect(() => parseEnv({...preview, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true'})).toThrow('emulators'));
  it('blocks accidental public credentials', () => expect(() => parseEnv({NEXT_PUBLIC_KHOA_API_KEY: 'secret'})).toThrow('must not be public'));
  it('does not leak malformed values in errors', () => expect(() => parseEnv({NEXT_PUBLIC_SITE_URL: 'private-secret-value'})).toThrow(/^Invalid environment fields: NEXT_PUBLIC_SITE_URL$/));
  it('fails if deployment env is missing', () => expect(() => parseEnv({VERCEL_ENV: 'preview'})).toThrow('must match'));
  it('rejects missing deployed Firebase configuration', () => expect(() => parseEnv({APP_ENV: 'production'})).toThrow('Missing'));
});
