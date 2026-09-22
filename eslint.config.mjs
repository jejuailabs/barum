import {FlatCompat} from '@eslint/eslintrc';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const compat = new FlatCompat({baseDirectory: path.dirname(fileURLToPath(import.meta.url))});
const config = [
  {ignores: ['.next/**', '.tools/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts']},
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {rules: {'@typescript-eslint/no-explicit-any': 'error'}}
];
export default config;
