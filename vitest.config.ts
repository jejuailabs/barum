import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  resolve: {alias: {'@': fileURLToPath(new URL('./src', import.meta.url))}},
  test: {
    include: ['tests/unit/**/*.test.ts'], environment: 'node',
    coverage: {
      provider: 'v8', reporter: ['text', 'json-summary'],
      include: ['src/lib/tide/calculate.ts', 'src/lib/grid/interpolate.ts', 'src/lib/sources/{cache,priority}.ts', 'src/lib/sources/cctv/health.ts', 'src/lib/sources/grid/preview.ts', 'src/lib/sources/kma/{codes,grid,ultraNcst,forecast}.ts', 'src/lib/sources/khoa/tidePrediction.ts', 'src/lib/sources/openmeteo/{forecast,marine,tide}.ts'],
      thresholds: {lines: 80, functions: 80, statements: 80}
    }
  }
});
