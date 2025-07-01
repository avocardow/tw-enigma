/**
 * Jest Configuration for Integration Tests
 * 
 * Specialized configuration for running comprehensive integration tests
 * with longer timeouts and additional setup for complex scenarios
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.ts',
    '<rootDir>/tests/detectors/**/*.test.ts',
  ],
  
  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/integration.setup.ts',
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/**/types.ts',
  ],
  coverageDirectory: '<rootDir>/coverage/integration',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Timeout settings for integration tests
  testTimeout: 30000, // 30 seconds for complex integration scenarios
  
  // Performance settings
  maxWorkers: '50%', // Use half the available workers for stability
  
  // Error handling
  bail: false, // Continue running tests even if some fail
  verbose: true,
  
  // Module paths
  modulePaths: ['<rootDir>/src'],
  
  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.next/',
    '/coverage/',
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // Global test environment variables
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true,
    },
  },
  
  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/integration/html-report',
        filename: 'integration-test-report.html',
        openReport: false,
        expand: true,
        hideIcon: false,
        pageTitle: 'TW-Enigma Integration Test Report',
        logoImgPath: undefined,
        includeFailureMsg: true,
        includeSuiteFailure: true,
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage/integration',
        outputName: 'integration-test-results.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: false,
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        includeConsoleOutput: true,
      },
    ],
  ],
  
  // Watch mode settings
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
  ],
  
  // Error handling
  errorOnDeprecated: true,
  
  // Custom matchers and utilities
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/matchers.ts',
    '<rootDir>/tests/setup/integration.setup.ts',
  ],
};