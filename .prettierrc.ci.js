// Prettier configuration for CI environments
// Extends base config with CI-specific settings

module.exports = {
  // Import base config
  ...require('./.prettierrc'),
  
  // CI-specific overrides
  endOfLine: 'lf', // Enforce Unix line endings in CI
  insertFinalNewline: true,
  
  // Override for stricter CI formatting
  trailingComma: 'all', // More strict than base config
  arrowParens: 'always', // Keep base config setting
  
  // Ignore CI-specific directories
  ignore: [
    'dist/**',
    'build/**',
    'coverage/**',
    'node_modules/**',
    'test-results/**',
    'benchmark-results/**',
    '.test-isolation/**',
    '.dedup*/**',
    '.differential*/**',
    '.enigma/**',
    '.incremental/**',
    '*.min.js',
    '*.min.css',
  ],
};