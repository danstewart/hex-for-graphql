import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    dedupe: ['graphql'],
  },
  test: {
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    maxWorkers: 1,
  },
});
