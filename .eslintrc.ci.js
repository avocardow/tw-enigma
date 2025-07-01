// ESLint configuration optimized for CI environments
// This extends the main config with CI-specific settings for better error reporting

const baseConfig = require('./eslint.config.js');

module.exports = {
  ...baseConfig,
  
  // Override specific settings for CI
  overrides: [
    {
      files: ['**/*.{ts,js}'],
      rules: {
        // Stricter rules in CI
        '@typescript-eslint/no-explicit-any': 'error', // Upgrade from warn to error
        '@typescript-eslint/no-non-null-assertion': 'error',
        'no-console': ['error', { allow: ['error'] }], // Only allow console.error
        
        // Performance-critical rules
        'no-await-in-loop': 'error',
        
        // Security rules are errors in CI
        'no-eval': 'error',
        'no-implied-eval': 'error',
      },
    },
    {
      files: ['**/*.test.{ts,js}', '**/*.spec.{ts,js}', '**/tests/**/*.{ts,js}'],
      rules: {
        // More lenient for test files
        '@typescript-eslint/no-explicit-any': 'warn',
        'no-console': 'off',
        '@typescript-eslint/no-non-null-assertion': 'warn',
      },
    },
    {
      files: ['scripts/**/*.js', '**/scripts/**/*.js'],
      rules: {
        // Scripts can be more lenient but still safe
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  
  // CI-specific reporting
  reportUnusedDisableDirectives: true,
  errorOnUnmatchedPattern: true,
  
  // Output format for CI
  ...(process.env.CI && {
    format: 'json',
    outputFile: 'eslint-report.json',
  }),
};