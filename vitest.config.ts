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
    
    // Disable coverage by default to prevent hanging
    coverage: {
      enabled: false
    }
  }
}) 