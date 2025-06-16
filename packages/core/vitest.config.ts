import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Environment setup
    environment: 'node',
    globals: true,

    // Test file patterns
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.turbo'],

    // Timeout configuration
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 10000, // 10 seconds for setup/teardown

    // Performance settings
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },

    // Mock and cleanup settings
    clearMocks: true,
    restoreMocks: true,

    // Reporter configuration
    reporter: ['verbose', 'json'],
    outputFile: './test-results.json',

    // Coverage configuration
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.js',
        '**/*.config.ts',
        'vitest.config.ts',
        'tsup.config.ts',
        'test/',
        'tests/',
      ],
      thresholds: {
        global: {
          lines: 85,
          functions: 80,
          branches: 75,
          statements: 85,
        },
      },
    },

    // Module resolution for monorepo
    alias: {
      '@': resolve(__dirname, './src'),
    },

    // Setup files
    setupFiles: ['./test-setup.ts'],
  },

  // TypeScript configuration
  esbuild: {
    target: 'node18',
  },

  // Resolve configuration for monorepo
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  // Define configuration
  define: {
    __TEST__: true,
  },
});
