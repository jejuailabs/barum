import {z} from 'zod';

const optional = z.preprocess(value => value === '' ? undefined : value, z.string().min(1).optional());
const schema = z.object({
  APP_ENV: z.enum(['local', 'preview', 'production']).default('local'),
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_FIREBASE_API_KEY: optional,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optional,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: optional,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: optional,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: optional,
  NEXT_PUBLIC_FIREBASE_APP_ID: optional,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: optional,
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: z.enum(['true', 'false']).default('true'),
  FIREBASE_SERVICE_ACCOUNT_JSON: optional,
  FIREBASE_PROJECT_ID: optional,
  KMA_SERVICE_KEY: optional,
  KHOA_SERVICE_KEY: optional
});

/** Validate only enabled Phase 0 services, without leaking secret values into errors. */
export function parseEnv(raw: Record<string, string | undefined>) {
  for (const key of Object.keys(raw)) {
    if (/^NEXT_PUBLIC_.*(SECRET|PRIVATE_KEY|SERVICE_ACCOUNT|KMA|KHOA|SERVICE_KEY|ACCESS_TOKEN)/.test(key)) {
      throw new Error(`Server credential must not be public: ${key}`);
    }
  }
  // The hosting platform is authoritative; APP_ENV is a fallback outside Vercel.
  const appEnv = raw.VERCEL_ENV === 'development' ? 'local' : raw.VERCEL_ENV || raw.APP_ENV;
  let siteUrl = raw.NEXT_PUBLIC_SITE_URL?.trim() || undefined;
  const localSite = siteUrl && URL.canParse(siteUrl)
    && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(siteUrl).hostname);
  if (raw.VERCEL_ENV === 'production' || raw.VERCEL_ENV === 'preview') {
    const deploymentHost = raw.VERCEL_ENV === 'production'
      ? raw.VERCEL_PROJECT_PRODUCTION_URL || raw.VERCEL_URL
      : raw.VERCEL_URL;
    if ((!siteUrl || localSite) && deploymentHost) siteUrl = `https://${deploymentHost}`;
  }
  const result = schema.safeParse({...raw, APP_ENV: appEnv, NEXT_PUBLIC_SITE_URL: siteUrl});
  if (!result.success) throw new Error(`Invalid environment fields: ${result.error.issues.map(i => i.path.join('.')).join(', ')}`);
  const env = result.data;
  if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
    if (env.APP_ENV !== 'local') throw new Error('Deployed apps must not use emulators');
    if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'demo-barum') throw new Error('Local emulators require demo-barum');
  } else {
    const required = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID',
      'FIREBASE_PROJECT_ID'] as const;
    const missing = required.filter(key => !env[key]);
    if (missing.length) throw new Error(`Missing environment fields: ${missing.join(', ')}`);
    if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== env.FIREBASE_PROJECT_ID) throw new Error('Firebase client/server project mismatch');
  }
  if (env.APP_ENV !== 'local' && !env.NEXT_PUBLIC_SITE_URL.startsWith('https://')) throw new Error('Deployed site URL must use HTTPS');
  return env;
}
