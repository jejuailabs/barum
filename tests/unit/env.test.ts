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
  it.each(['preview', 'production'])('infers %s without APP_ENV', deployment => {
    expect(parseEnv({...preview, APP_ENV: undefined, VERCEL_ENV: deployment}).APP_ENV).toBe(deployment);
  });
  it.each(['local', 'preview'])('uses production over stale APP_ENV=%s', appEnv => {
    expect(parseEnv({...preview, APP_ENV: appEnv, VERCEL_ENV: 'production'}).APP_ENV).toBe('production');
  });
  it('maps Vercel development to local', () => expect(parseEnv({VERCEL_ENV: 'development'}).APP_ENV).toBe('local'));
  it('keeps deployed emulator protection with stale APP_ENV', () => expect(() => parseEnv({APP_ENV: 'local', VERCEL_ENV: 'production'})).toThrow('emulators'));
  it('keeps deployed HTTPS protection with stale APP_ENV', () => expect(() => parseEnv({...preview, APP_ENV: 'local', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000'})).toThrow('HTTPS'));
  it('rejects missing cloud Firebase configuration', () => expect(() => parseEnv({APP_ENV: 'production', NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'false'})).toThrow('Missing'));
  it('rejects a real project with emulators enabled', () => expect(() => parseEnv({NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'barum-10aad'})).toThrow('demo-barum'));
  it.each([undefined, '', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000'])('resolves deployed URL when site URL is %s', siteUrl => {
    expect(parseEnv({...preview, NEXT_PUBLIC_SITE_URL: siteUrl, VERCEL_URL: 'barum-preview.vercel.app'}).NEXT_PUBLIC_SITE_URL).toBe('https://barum-preview.vercel.app');
  });
  it('prefers production domain in production', () => {
    expect(parseEnv({...preview, VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: undefined, VERCEL_URL: 'barum-build.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'barum.example'}).NEXT_PUBLIC_SITE_URL).toBe('https://barum.example');
  });
  it('does not send preview links to production', () => {
    expect(parseEnv({...preview, NEXT_PUBLIC_SITE_URL: undefined, VERCEL_URL: 'barum-preview.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'barum.example'}).NEXT_PUBLIC_SITE_URL).toBe('https://barum-preview.vercel.app');
  });
  it('preserves explicit custom HTTPS URL', () => {
    expect(parseEnv({...preview, VERCEL_URL: 'barum-build.vercel.app'}).NEXT_PUBLIC_SITE_URL).toBe(preview.NEXT_PUBLIC_SITE_URL);
  });
  it('preserves local URL during development', () => {
    expect(parseEnv({VERCEL_ENV: 'development', VERCEL_URL: 'barum-build.vercel.app'}).NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3000');
  });
  it('still rejects insecure external URLs', () => {
    expect(() => parseEnv({...preview, NEXT_PUBLIC_SITE_URL: 'http://barum.example', VERCEL_URL: 'barum-build.vercel.app'})).toThrow('HTTPS');
  });
});
