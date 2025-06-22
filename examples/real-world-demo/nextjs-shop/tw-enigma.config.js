/** @type {import('@tw-enigma/core').EnigmaConfig} */
module.exports = {
  // Core optimization settings
  optimize: {
    enabled: true,
    obfuscateClassNames: true,
    minifyCSS: true,
    removeUnused: true,
    generateSourceMaps: process.env.NODE_ENV === 'development',
  },

  // Class name generation
  classNames: {
    length: 5,
    prefix: '',
    algorithm: 'base62',
    avoidCollisions: true,
    prettier: true,
  },

  // Input/Output configuration
  input: {
    css: './src/styles/globals.css',
    html: ['./src/**/*.{js,ts,jsx,tsx}'],
    ignore: ['./node_modules/**', './dist/**', './.next/**'],
  },

  output: {
    css: './dist/optimized.css',
    map: './dist/class-mappings.json',
    report: './dist/optimization-report.json',
  },

  // Framework-specific settings
  framework: {
    type: 'nextjs',
    version: '15.x',
    buildDir: './.next',
    publicDir: './public',
  },

  // Scramble integration for privacy protection
  scramble: {
    enabled: true,
    // Protect sensitive form fields
    protectForms: {
      enabled: true,
      fields: ['email', 'password', 'credit-card', 'phone'],
      scrambleDelay: 100,
    },
    // Protect sensitive data display
    protectData: {
      enabled: true,
      selectors: [
        '[data-sensitive]',
        '.user-email',
        '.credit-card-number',
        '.phone-number',
      ],
      scrambleOnIdle: true,
      idleTimeout: 5000,
    },
    // Security settings
    security: {
      preventInspection: false, // Keep false for demo purposes
      obfuscateHTML: true,
      protectAgainstBots: true,
    },
  },

  // Performance optimization
  performance: {
    asyncProcessing: true,
    cacheOptimizations: true,
    batchSize: 100,
    workerThreads: true,
  },

  // Development settings
  development: {
    enabled: process.env.NODE_ENV === 'development',
    hotReload: true,
    verboseLogging: true,
    showMappings: true,
  },

  // Analytics and reporting
  analytics: {
    trackOptimizations: true,
    measurePerformance: true,
    generateReports: true,
    reportFormats: ['json', 'html'],
  },
};