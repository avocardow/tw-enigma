/**
 * Integration Test Setup
 * 
 * Global setup and utilities for integration testing
 */

import { jest } from '@jest/globals';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveFrameworkType(frameworkType: string): R;
      toHaveSSRCapability(): R;
      toHaveHighConfidence(): R;
      toDetectCSSInJS(): R;
      toHandleErrorsGracefully(): R;
    }
  }
}

// Environment setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.TW_ENIGMA_TEST_MODE = 'true';
  
  // Suppress console warnings during tests unless debugging
  if (!process.env.DEBUG_TESTS) {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  }
});

// Cleanup after all tests
afterAll(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Per-test cleanup
afterEach(() => {
  // Clear any file system mocks
  jest.clearAllMocks();
});