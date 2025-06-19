/**
 * Shared Test Utilities for Core Package
 * Provides common testing helpers, mocks, and fixtures
 */

import { vi } from 'vitest';

/**
 * Mock file system helpers
 */
export const createMockFS = () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn(),
  rmdir: vi.fn(),
  readdir: vi.fn(),
});

/**
 * Mock CSS content for testing
 */
export const mockCSSContent = {
  simple: 'body { margin: 0; padding: 0; }',
  complex: `
    .container { 
      display: flex; 
      justify-content: center; 
      align-items: center;
      background: linear-gradient(45deg, #ff0000, #00ff00);
    }
    .button { 
      padding: 10px 20px; 
      border: none; 
      border-radius: 4px; 
    }
  `,
  tailwind: 'body { @apply flex justify-center items-center; }',
};

/**
 * Mock configuration objects
 */
export const mockConfig = {
  basic: {
    minify: true,
    extractorPatterns: ['**/*.html', '**/*.js'],
    outputPath: './dist',
  },
  advanced: {
    minify: true,
    removeUnused: true,
    extractorPatterns: ['**/*.html', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
    outputPath: './dist',
    sourceMaps: true,
    watchMode: false,
    plugins: [],
  },
};

/**
 * Create mock logger for testing
 */
export const createMockLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
  performance: vi.fn(),
});

/**
 * Mock optimization result
 */
export const createMockOptimizationResult = () => ({
  optimizedCSS: '.optimized { color: red; }',
  originalSize: 1000,
  optimizedSize: 500,
  compressionRatio: 0.5,
  optimizations: ['minification', 'unused-removal'],
  processingTime: 150,
  sourceMap: null,
});

/**
 * Test file cleanup helper
 */
export const cleanupTestFiles = async (filePaths: string[]) => {
  const fs = await import('fs/promises');
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore cleanup errors
    }
  }
};

/**
 * Wait for async operations in tests
 */
export const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create temporary test directory
 */
export const createTempDir = async (prefix = 'tw-enigma-test') => {
  const os = await import('os');
  const path = await import('path');
  const fs = await import('fs/promises');

  const tempDir = path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
};

/**
 * Assert that async function throws with specific message
 */
export const expectAsyncThrow = async (fn: () => Promise<any>, expectedMessage?: string) => {
  let error: Error | null = null;
  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }

  if (!error) {
    throw new Error('Expected function to throw, but it did not');
  }

  if (expectedMessage && !error.message.includes(expectedMessage)) {
    throw new Error(
      `Expected error message to contain "${expectedMessage}", but got "${error.message}"`
    );
  }

  return error;
};
