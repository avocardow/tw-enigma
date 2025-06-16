import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Core package tests
  {
    extends: './packages/core/vitest.config.ts',
    test: {
      name: 'core',
      root: './packages/core',
      environment: 'node',
    },
  },
  
  // CLI package tests
  {
    extends: './packages/cli/vitest.config.ts',
    test: {
      name: 'cli',
      root: './packages/cli',
      environment: 'node',
    },
  },
  
  // Integration tests (if needed)
  {
    test: {
      name: 'integration',
      root: './',
      include: ['tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      environment: 'node',
      testTimeout: 60000, // Longer timeout for integration tests
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: true, // Integration tests should run sequentially
        },
      },
    },
  },
]); 