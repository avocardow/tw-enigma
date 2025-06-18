import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Core package tests
  {
    extends: '../packages/core/vitest.config.ts',
    test: {
      name: 'core',
      include: ['../packages/core/tests/**/*.test.ts'],
      exclude: ['../packages/core/tests/**/*.integration.test.ts'],
    },
  },

  // CLI package tests
  {
    extends: '../packages/cli/vitest.config.ts',
    test: {
      name: 'cli',
      include: ['../packages/cli/tests/**/*.test.ts'],
      exclude: ['../packages/cli/tests/**/*.integration.test.ts'],
    },
  },

  // Integration tests - Enhanced configuration
  {
    test: {
      name: 'integration',
      root: './',
      include: ['tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: ['tests/integration/docs/**/*', 'tests/integration/fixtures/**/*'],
      environment: 'node',

      // Enhanced timeout configuration for complex integration scenarios
      testTimeout: 120000, // 2 minutes per test (increased from 1 minute)
      hookTimeout: 30000, // 30 seconds for setup/teardown hooks

      // Test execution configuration
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: true, // Sequential execution prevents conflicts
          isolate: true, // Isolate test environment
        },
      },

      // Retry configuration for CI stability
      retry: process.env.CI ? 2 : 0,

      // Setup configuration
      setupFiles: ['tests/integration/setup/vitest.setup.ts'],

      // Environment variables for integration testing
      env: {
        NODE_ENV: 'test',
        INTEGRATION_TEST: 'true',
        // Disable external API calls during testing
        DISABLE_EXTERNAL_APIS: 'true',
      },

      // Reporter configuration for detailed output
      reporters: process.env.CI ? ['basic', 'junit'] : ['verbose'],

      // Output configuration
      outputFile: {
        junit: 'test-results/integration-results.xml',
      },
    },
  },
]);
