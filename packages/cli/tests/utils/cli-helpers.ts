/**
 * Shared Test Utilities for CLI Package
 * Provides common CLI testing helpers and mocks
 */

import { vi } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

/**
 * CLI command execution result
 */
export interface CLIResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

/**
 * Execute CLI command for testing
 */
export const runCLI = async (args: string[], options: {
  cwd?: string;
  timeout?: number;
  input?: string;
} = {}): Promise<CLIResult> => {
  const { cwd = process.cwd(), timeout = 10000, input } = options;
  const cliPath = join(__dirname, '../../dist/enigma.js');
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const child: ChildProcess = spawn('node', [cliPath, ...args], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    if (input) {
      child.stdin?.write(input);
      child.stdin?.end();
    }

    const timeoutHandle = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`CLI command timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', (exitCode) => {
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;
      resolve({
        exitCode: exitCode || 0,
        stdout,
        stderr,
        duration,
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });
  });
};

/**
 * Mock process arguments for CLI testing
 */
export const mockProcessArgv = (args: string[]) => {
  const originalArgv = process.argv;
  process.argv = ['node', 'enigma.js', ...args];
  return () => {
    process.argv = originalArgv;
  };
};

/**
 * Mock console methods for CLI testing
 */
export const mockConsole = () => {
  const originalConsole = { ...console };
  const mocks = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  };
  
  Object.assign(console, mocks);
  
  return {
    mocks,
    restore: () => Object.assign(console, originalConsole),
  };
};

/**
 * Create temporary config file for testing
 */
export const createTempConfig = async (config: object) => {
  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');
  
  const tempDir = os.tmpdir();
  const configPath = path.join(tempDir, `tw-enigma-test-config-${Date.now()}.json`);
  
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  return configPath;
};

/**
 * Clean up temporary files created during testing
 */
export const cleanupTempFiles = async (filePaths: string[]) => {
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
 * Mock file system for CLI tests
 */
export const createMockFileSystem = () => {
  const fs = vi.hoisted(() => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
  }));
  
  return fs;
};

/**
 * Assert CLI output contains expected patterns
 */
export const expectCLIOutput = (result: CLIResult, expectations: {
  exitCode?: number;
  stdout?: string | RegExp;
  stderr?: string | RegExp;
  maxDuration?: number;
}) => {
  if (expectations.exitCode !== undefined) {
    if (result.exitCode !== expectations.exitCode) {
      throw new Error(`Expected exit code ${expectations.exitCode}, got ${result.exitCode}`);
    }
  }
  
  if (expectations.stdout) {
    const matches = typeof expectations.stdout === 'string' 
      ? result.stdout.includes(expectations.stdout)
      : expectations.stdout.test(result.stdout);
    if (!matches) {
      throw new Error(`Expected stdout to match "${expectations.stdout}", got: "${result.stdout}"`);
    }
  }
  
  if (expectations.stderr) {
    const matches = typeof expectations.stderr === 'string' 
      ? result.stderr.includes(expectations.stderr)
      : expectations.stderr.test(result.stderr);
    if (!matches) {
      throw new Error(`Expected stderr to match "${expectations.stderr}", got: "${result.stderr}"`);
    }
  }
  
  if (expectations.maxDuration && result.duration > expectations.maxDuration) {
    throw new Error(`Expected duration <= ${expectations.maxDuration}ms, got ${result.duration}ms`);
  }
};

/**
 * Common CLI test configurations
 */
export const testConfigs = {
  minimal: {
    minify: true,
    extractorPatterns: ['**/*.html'],
  },
  standard: {
    minify: true,
    removeUnused: true,
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
    performance: {
      budget: 100,
      warnOnly: false,
    },
  },
}; 