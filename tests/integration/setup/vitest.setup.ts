/**
 * Integration Test Setup for Vitest
 *
 * This file configures the test environment for integration tests,
 * including environment variables and global utilities.
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test environment configuration
export const TEST_ENV = {
  // Integration test identification
  INTEGRATION_TEST: true,

  // Project paths
  PROJECT_ROOT: process.cwd(),
  CLI_PACKAGE_PATH: path.join(process.cwd(), 'packages', 'cli'),
  CORE_PACKAGE_PATH: path.join(process.cwd(), 'packages', 'core'),

  // Test data paths
  FIXTURES_PATH: path.join(process.cwd(), 'tests', 'integration', 'fixtures'),
  TEMP_PATH: path.join(process.cwd(), 'tests', 'integration', 'temp'),

  // Timeout configurations
  DEFAULT_TIMEOUT: 30000,
  EXTENDED_TIMEOUT: 60000,
  CLI_TIMEOUT: 45000,
} as const;

// Global test utilities
declare global {
  var testEnv: typeof TEST_ENV;
  var cleanupFns: (() => void | Promise<void>)[];
}

// Initialize global environment
globalThis.testEnv = TEST_ENV;
globalThis.cleanupFns = [];

// Set up environment variables
process.env.NODE_ENV = 'test';
process.env.INTEGRATION_TEST = 'true';
process.env.DISABLE_EXTERNAL_APIS = 'true';

/**
 * Utility function to register additional cleanup
 */
export function addCleanup(fn: () => void | Promise<void>) {
  globalThis.cleanupFns.push(fn);
}

/**
 * Environment validation
 */
export function validateTestEnvironment() {
  const requiredEnvVars = ['NODE_ENV', 'INTEGRATION_TEST'];
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Expected NODE_ENV=test, got: ${process.env.NODE_ENV}`);
  }
}

/**
 * Setup temp directory
 */
export async function setupTempDirectory() {
  try {
    await fs.mkdir(TEST_ENV.TEMP_PATH, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

// Validate environment on load
validateTestEnvironment();
setupTempDirectory();
