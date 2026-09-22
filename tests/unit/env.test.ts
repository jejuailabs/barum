import {describe, expect, it} from 'vitest';
import {parseEnv} from '../../src/env';

const preview = {
  APP_ENV: 'preview', VERCEL_ENV: 'preview', NEXT_PUBLIC_SITE_URL: 'https://barum.example',
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'false', NEXT_PUBLIC_FIREBASE_API_KEY: 'public-web-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'barum-10aad.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'barum-10aad', NEXT_PUBLIC_FIREBASE_APP_ID: 'web-app',
  FIREBASE_PROJECT_ID: 'barum-10aad'
};
describe('environment boundary', () => {
  it('starts local without production credentials', () => expect(parseEnv({}).APP_ENV).toBe('local'));
  it('accepts the selected cloud project in preview', () => expect(parseEnv(preview).APP_ENV).toBe('preview'));
  it('blocks client/server project mismatch', () => expect(() => parseEnv({...preview, FIREBASE_PROJECT_ID: 'another-project'})).toThrow('project mismatch'));
  it('allows local development to use cloud Firebase', () => expect(parseEnv({...preview, APP_ENV: 'local', VERCEL_ENV: undefined, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000'}).NEXT_PUBLIC_USE_FIREBASE_EMULATORS).toBe('false'));
  it('blocks deployed emulator configuration', () => expect(() => parseEnv({...preview, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true'})).toThrow('emulators'));
  it('blocks accidental public credentials', () => expect(() => parseEnv({NEXT_PUBLIC_KHOA_API_KEY: 'secret'})).toThrow('must not be public'));
  it('does not leak malformed values in errors', () => expect(() => parseEnv({NEXT_PUBLIC_SITE_URL: 'private-secret-value'})).toThrow(/^Invalid environment fields: NEXT_PUBLIC_SITE_URL$/));
  it('fails if deployment env is missing', () => expect(() => parseEnv({VERCEL_ENV: 'preview'})).toThrow('must match'));
  it('rejects missing cloud Firebase configuration', () => expect(() => parseEnv({APP_ENV: 'production', NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'false'})).toThrow('Missing'));
  it('rejects a real project with emulators enabled', () => expect(() => parseEnv({NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'barum-10aad'})).toThrow('demo-barum'));
});
