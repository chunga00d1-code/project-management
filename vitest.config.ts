import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['backend/test/**/*.test.ts', 'frontend/src/__tests__/**/*.test.ts', 'frontend/src/__tests__/**/*.test.tsx'],
    environment: 'node',
    environmentMatchGlobs: [['frontend/src/__tests__/responsive/**/*.test.tsx', 'jsdom']],
    setupFiles: ['frontend/src/test/setup.ts'],
  },
});
