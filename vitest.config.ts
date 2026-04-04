import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/live/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        'src/shared/**': { lines: 90, functions: 90 },
        'src/registry.ts': { lines: 90, functions: 90 },
        'src/services/**': { lines: 75, functions: 75 },
        'src/trash/**': { lines: 75, functions: 75 },
        'src/clients/**': { lines: 70, functions: 70 },
      },
    },
  },
});
