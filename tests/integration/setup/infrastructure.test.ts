/**
 * Infrastructure Validation Test
 *
 * This test validates that the integration test infrastructure is working correctly.
 * It serves as a smoke test for our enhanced Vitest configuration.
 */

import fs from 'fs/promises';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Integration Test Infrastructure', () => {
  beforeAll(async () => {
    // Ensure temp directory is created
    if (globalThis.testEnv) {
      try {
        await fs.mkdir(globalThis.testEnv.TEMP_PATH, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }
  });

  it('should have access to test environment configuration', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.INTEGRATION_TEST).toBe('true');
    expect(process.env.DISABLE_EXTERNAL_APIS).toBe('true');
  });

  it('should have access to global test environment', () => {
    expect(globalThis.testEnv).toBeDefined();
    expect(globalThis.testEnv.INTEGRATION_TEST).toBe(true);
    expect(globalThis.testEnv.PROJECT_ROOT).toBeDefined();
    expect(globalThis.testEnv.CLI_PACKAGE_PATH).toBeDefined();
    expect(globalThis.testEnv.CORE_PACKAGE_PATH).toBeDefined();
  });

  it('should have project structure available', async () => {
    const { testEnv } = globalThis;

    // Verify CLI package exists
    await expect(fs.access(testEnv.CLI_PACKAGE_PATH)).resolves.toBeUndefined();

    // Verify Core package exists
    await expect(fs.access(testEnv.CORE_PACKAGE_PATH)).resolves.toBeUndefined();

    // Verify integration test directory exists
    const integrationPath = path.join(testEnv.PROJECT_ROOT, 'tests', 'integration');
    await expect(fs.access(integrationPath)).resolves.toBeUndefined();
  });

  it('should have cleanup functions available', () => {
    expect(globalThis.cleanupFns).toBeDefined();
    expect(Array.isArray(globalThis.cleanupFns)).toBe(true);
  });

  it('should have temp directory access', async () => {
    const { testEnv } = globalThis;

    // Verify temp path exists
    await expect(fs.access(testEnv.TEMP_PATH)).resolves.toBeUndefined();

    // Test write access with a unique filename
    const testFile = path.join(testEnv.TEMP_PATH, `test-write-access-${Date.now()}.txt`);
    await fs.writeFile(testFile, 'test content');

    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe('test content');

    // Cleanup
    await fs.unlink(testFile);
  });

  it('should have correct timeout configurations', () => {
    const { testEnv } = globalThis;

    expect(testEnv.DEFAULT_TIMEOUT).toBe(30000);
    expect(testEnv.EXTENDED_TIMEOUT).toBe(60000);
    expect(testEnv.CLI_TIMEOUT).toBe(45000);
  });
});
