import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

// CI environment detection
const isCI = process.env.CI === 'true' || process.env.CI === '1';
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  test: {
    // Environment setup for CLI testing
    environment: 'node',
    globals: true,

    // Test file patterns
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.turbo', 'test-temp'],

    // Enhanced timeout configuration for CI
    testTimeout: isCI ? 60000 : 45000, // 60s in CI, 45s local
    hookTimeout: isCI ? 20000 : 15000, // 20s in CI, 15s local

    // Performance settings optimized for CI
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // CLI tests should run sequentially to avoid conflicts
        maxThreads: 1,
        minThreads: 1,
      },
    },

    // Mock and cleanup settings
    clearMocks: true,
    restoreMocks: true,

    // Enhanced reporter configuration for CI
    reporter: isCI ? ['verbose', 'json', 'junit'] : ['verbose', 'json'],
    outputFile: {
      json: './test-results.json',
      junit: isCI ? './test-results.xml' : undefined,
    },

    // Retry configuration for CI stability
    retry: isCI ? 2 : 0, // Retry failed tests in CI

    // Coverage configuration
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'bin/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.js',
        '**/*.config.ts',
        'vitest.config.ts',
        'tsup.config.ts',
        'tests/fixtures/**',
        'tests/utils/**',
        'test-temp/**',
      ],
      thresholds: {
        global: {
          lines: 80,
          functions: 75,
          branches: 70,
          statements: 80,
        },
      },
    },

    // Module resolution for monorepo
    alias: {
      '@tw-enigma/cli': resolve(__dirname, './src'),
      '@tw-enigma/core': resolve(__dirname, '../core/src'),
    },

    // Enhanced environment variables for CI testing
    env: {
      NODE_ENV: 'test',
      CLI_TEST_MODE: 'true',
      CI: isCI ? 'true' : 'false',
      GITHUB_ACTIONS: isGitHubActions ? 'true' : 'false',
      DEBUG_CLI: isCI ? 'true' : 'false', // Enable CLI debugging in CI
      FORCE_COLOR: '0', // Disable colors for consistent output
    },

    // Setup files for enhanced testing
    setupFiles: ['./tests/test-config.ts'],

    // Bail configuration for CI efficiency
    bail: isCI ? 5 : 0, // Stop after 5 failures in CI
  },

  // TypeScript configuration
  esbuild: {
    target: 'node18',
  },

  // Resolve configuration for monorepo
  resolve: {
    alias: {
      '@tw-enigma/cli': resolve(__dirname, './src'),
      '@tw-enigma/core': resolve(__dirname, '../core/src'),
    },
  },
});
