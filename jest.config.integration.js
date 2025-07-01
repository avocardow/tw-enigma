/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  displayName: 'Integration Tests',
  roots: ['<rootDir>/packages'],
  testMatch: [
    '**/packages/**/tests/**/*.integration.ts',
    '**/packages/**/tests/**/*.integration.test.ts',
    '**/packages/**/tests/integration/**/*.ts',
    '**/packages/**/tests/integration/**/*.test.ts',
  ],
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    '!packages/**/src/**/*.d.ts',
    '!packages/**/dist/**',
    '!packages/**/node_modules/**',
  ],
  coverageDirectory: '<rootDir>/coverage/integration',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/packages/core/test-setup.ts'
  ],
  moduleNameMapping: {
    '^@tw-enigma/core$': '<rootDir>/packages/core/src',
    '^@tw-enigma/core/(.*)$': '<rootDir>/packages/core/src/$1',
    '^@tw-enigma/cli$': '<rootDir>/packages/cli/src',
    '^@tw-enigma/cli/(.*)$': '<rootDir>/packages/cli/src/$1',
  },
  testTimeout: 60000, // Longer timeout for integration tests
  maxWorkers: 1, // Sequential execution for integration tests
  forceExit: true,
  verbose: true,
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/test-temp/',
    '/__tests__/',
    '/fixtures/',
  ],
  // Custom reporters for CI integration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'integration-test-results.xml',
    }],
  ],
  // Global setup and teardown for integration tests
  globalSetup: '<rootDir>/packages/cli/tests/test-config.ts',
  // Environment variables for test consistency
  testEnvironmentOptions: {
    NODE_ENV: 'test',
    CI: process.env.CI || 'false',
  },
};