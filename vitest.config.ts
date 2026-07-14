import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'node', include: ['backend/test/**/*.test.ts', 'frontend/src/__tests__/**/*.test.ts'], environment: 'node', setupFiles: ['frontend/src/test/setup.ts'] } },
      { test: { name: 'responsive', include: ['frontend/src/__tests__/responsive/**/*.test.tsx'], environment: 'jsdom', setupFiles: ['frontend/src/test/setup.ts'] } },
    ],
  },
});
