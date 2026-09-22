import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import {parseEnv} from './src/env';

parseEnv(process.env);
const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{source: '/:path*', headers: [
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'X-Frame-Options', value: 'DENY'}
    ]}];
  }
};
export default createNextIntlPlugin('./src/i18n/request.ts')(config);
