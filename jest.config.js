/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: [
    '**/packages/**/__tests__/**/*.ts',
    '**/packages/**/?(*.)+(spec|test).ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/test-temp/',
    'integration.test.ts',
    'integration.ts',
    '/tests/integration/',
  ],
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    '!packages/**/src/**/*.d.ts',
    '!packages/**/dist/**',
    '!packages/**/node_modules/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
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
  testTimeout: 30000,
  maxWorkers: 1,
  forceExit: true,
  verbose: process.env.CI === 'true',
  collectCoverage: false, // Disabled by default, enable with --coverage flag
  // Custom reporters for CI integration
  reporters: process.env.CI === 'true' ? [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'unit-test-results.xml',
    }],
  ] : ['default'],
};