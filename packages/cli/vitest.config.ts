import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Environment setup for CLI testing
    environment: 'node',
    globals: true,
    
    // Test file patterns
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.turbo'],
    
    // Timeout configuration (CLI tests may need more time)
    testTimeout: 45000, // 45 seconds per test for CLI operations
    hookTimeout: 15000, // 15 seconds for setup/teardown
    
    // Performance settings
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
    
    // Reporter configuration
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results.json',
    },
    
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
    
    // Environment variables for CLI testing
    env: {
      NODE_ENV: 'test',
      CLI_TEST_MODE: 'true',
    },
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