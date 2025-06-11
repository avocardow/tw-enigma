import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Disable watch mode by default - prevents hanging in CI/automated runs
    watch: false,
    
    // Set a global timeout to prevent individual tests from hanging
    testTimeout: 30000, // 30 seconds per test
    
    // Set a global hook timeout
    hookTimeout: 10000, // 10 seconds for setup/teardown
    
    // Run tests in sequence to avoid resource conflicts
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    
    // Clean up between tests
    clearMocks: true,
    restoreMocks: true,
    
    // Configure test file patterns
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.git'],
    
    // Environment setup
    environment: 'node',
    
    // Globals for easier testing
    globals: true,
    
    // Reporter configuration - use basic reporter to avoid hanging
    reporter: ['verbose'],
    
    // Coverage configuration for CI/CD
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'test-files/**',
        'test-temp/**',
        'scripts/**',
        'tasks/**',
        '.taskmaster/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.js',
        '**/*.config.ts',
        '**/debug_test.js',
        '.github/**',
        'bin/**',
        'vitest.config.ts',
        'tsup.config.ts',
        'eslint.config.js'
      ],
      thresholds: {
        global: {
          lines: 80,
          functions: 75,
          branches: 70,
          statements: 80
        }
      }
    }
  }
}) 