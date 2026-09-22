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
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: z.enum(['true', 'false']).default('true'),
  FIREBASE_SERVICE_ACCOUNT_JSON: optional,
  FIREBASE_STAGING_PROJECT_ID: optional,
  FIREBASE_PRODUCTION_PROJECT_ID: optional
});

/** Validate only enabled Phase 0 services, without leaking secret values into errors. */
export function parseEnv(raw: Record<string, string | undefined>) {
  for (const key of Object.keys(raw)) {
    if (/^NEXT_PUBLIC_.*(SECRET|PRIVATE_KEY|SERVICE_ACCOUNT|KMA|KHOA|SERVICE_KEY|ACCESS_TOKEN)/.test(key)) {
      throw new Error(`Server credential must not be public: ${key}`);
    }
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`Invalid environment fields: ${result.error.issues.map(i => i.path.join('.')).join(', ')}`);
  const env = result.data;
  if (raw.VERCEL_ENV && raw.VERCEL_ENV !== 'development' && env.APP_ENV !== raw.VERCEL_ENV) {
    throw new Error('APP_ENV must match VERCEL_ENV');
  }
  if (env.APP_ENV !== 'local') {
    const required = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID',
      'FIREBASE_STAGING_PROJECT_ID', 'FIREBASE_PRODUCTION_PROJECT_ID'] as const;
    const missing = required.filter(key => !env[key]);
    if (missing.length) throw new Error(`Missing environment fields: ${missing.join(', ')}`);
    if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'false') throw new Error('Deployed apps must not use emulators');
    if (env.FIREBASE_STAGING_PROJECT_ID === env.FIREBASE_PRODUCTION_PROJECT_ID) throw new Error('Staging and production must use distinct projects');
    const expected = env.APP_ENV === 'preview' ? env.FIREBASE_STAGING_PROJECT_ID : env.FIREBASE_PRODUCTION_PROJECT_ID;
    if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== expected) throw new Error('Firebase project does not match APP_ENV');
    if (!env.NEXT_PUBLIC_SITE_URL.startsWith('https://')) throw new Error('Deployed site URL must use HTTPS');
  }
  return env;
}
