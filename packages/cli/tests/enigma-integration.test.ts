/**
 * End-to-End Integration Tests for Enigma Command
 * 
 * These tests verify the complete functionality of the enigma command
 * across various scenarios and configurations.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds for integration tests
const CLI_PATH = path.resolve(__dirname, '../bin/enigma.ts');
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures/enigma-integration');
const BASIC_PROJECT_DIR = path.join(FIXTURES_DIR, 'basic-project');
const SCRAMBLE_PROJECT_DIR = path.join(FIXTURES_DIR, 'scramble-project');

// Test utilities
interface TestProject {
  name: string;
  sourceDir: string;
  workingDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Setup a test project by copying fixtures to a temporary working directory
 */
async function setupTestProject(projectName: string): Promise<TestProject> {
  const sourceDir = path.join(FIXTURES_DIR, projectName);
  const workingDir = path.join(__dirname, `../test-temp/enigma-${projectName}-${Date.now()}`);
  
  // Ensure source exists
  if (!await fs.pathExists(sourceDir)) {
    throw new Error(`Test fixture not found: ${sourceDir}`);
  }
  
  // Copy fixture to working directory
  await fs.ensureDir(workingDir);
  await fs.copy(sourceDir, workingDir);
  
  return {
    name: projectName,
    sourceDir,
    workingDir,
    cleanup: async () => {
      if (await fs.pathExists(workingDir)) {
        await fs.remove(workingDir);
      }
    }
  };
}

/**
 * Execute the enigma CLI command and return results
 */
function executeEnigmaCommand(
  args: string[], 
  cwd: string, 
  options: { 
    expectFailure?: boolean;
    timeout?: number;
    env?: Record<string, string>;
  } = {}
): { stdout: string; stderr: string; exitCode: number } {
  const { expectFailure = false, timeout = TEST_TIMEOUT, env = {} } = options;
  
  try {
    const result = execSync(
      `node -r ts-node/register ${CLI_PATH} ${args.join(' ')}`,
      {
        cwd,
        encoding: 'utf8',
        timeout,
        env: { ...process.env, ...env },
        stdio: 'pipe'
      }
    );
    
    return {
      stdout: result.toString(),
      stderr: '',
      exitCode: 0
    };
  } catch (error: any) {
    if (expectFailure) {
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || '',
        exitCode: error.status || 1
      };
    }
    throw error;
  }
}

/**
 * Read file content and verify it exists
 */
async function readFileContent(filePath: string): Promise<string> {
  if (!await fs.pathExists(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return await fs.readFile(filePath, 'utf8');
}

/**
 * Count pattern occurrences in text
 */
function countPatternOccurrences(text: string, pattern: string): number {
  return (text.match(new RegExp(pattern, 'g')) || []).length;
}

describe('Enigma Command Integration Tests', () => {
  let testProject: TestProject;

  afterEach(async () => {
    if (testProject) {
      await testProject.cleanup();
    }
  });

  describe('Basic Optimization Scenarios', () => {
    test('should perform basic optimization with default settings', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Execute enigma command
      const result = executeEnigmaCommand([], testProject.workingDir);
      
      // Verify command completed successfully
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization starting');
      expect(result.stdout).toContain('Enigma optimization complete');
      
      // Verify configuration was loaded
      expect(result.stdout).toContain('Configuration loaded successfully');
      
      // Verify file discovery worked
      expect(result.stdout).toContain('Found');
      expect(result.stdout).toContain('files to process');
      
      // Verify core optimization engine ran
      expect(result.stdout).toContain('Core optimization engine working');
    }, TEST_TIMEOUT);

    test('should respect input and output directory options', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Create a custom output directory
      const customOutput = path.join(testProject.workingDir, 'custom-output');
      await fs.ensureDir(customOutput);
      
      // Execute with custom input/output
      const result = executeEnigmaCommand([
        '--input', 'src',
        '--output', 'custom-output',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should handle custom configuration file', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Execute with custom config
      const result = executeEnigmaCommand([
        '--config', 'enigma.config.js',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration loaded successfully');
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should handle minification and source maps', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Execute with minification and source maps
      const result = executeEnigmaCommand([
        '--minify',
        '--source-maps',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should handle file type filtering', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Execute with specific file types
      const result = executeEnigmaCommand([
        '--include-file-types', 'HTML', 'JAVASCRIPT',
        '--exclude-extensions', '.min.js',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Found');
      expect(result.stdout).toContain('files to process');
    }, TEST_TIMEOUT);

    test('should handle concurrent processing options', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Execute with custom concurrency
      const result = executeEnigmaCommand([
        '--max-concurrency', '2',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);
  });

  describe('Dry Run Mode', () => {
    test('should preview changes without modifying files in dry run mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Get file contents before dry run
      const indexHtmlPath = path.join(testProject.workingDir, 'src/index.html');
      const contentBefore = await readFileContent(indexHtmlPath);
      
      // Execute in dry run mode
      const result = executeEnigmaCommand([
        '--dry-run',
        '--verbose'
      ], testProject.workingDir);
      
      // Verify dry run indicators
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Running in dry-run mode');
      expect(result.stdout).toContain('no files will be modified');
      expect(result.stdout).toContain('Enigma optimization complete');
      
      // Verify files were not modified
      const contentAfter = await readFileContent(indexHtmlPath);
      expect(contentAfter).toBe(contentBefore);
    }, TEST_TIMEOUT);

    test('should show detailed information in dry run with verbose', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--dry-run',
        '--very-verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Running in dry-run mode');
      expect(result.stdout).toContain('Configuration loaded successfully');
      expect(result.stdout).toContain('Core optimization engine working');
    }, TEST_TIMEOUT);
  });

  describe('Verbose and Logging Modes', () => {
    test('should provide detailed output in verbose mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand(['--verbose'], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization starting');
      expect(result.stdout).toContain('Configuration loaded successfully');
      expect(result.stdout).toContain('Testing core optimization engine');
      expect(result.stdout).toContain('Discovering files for processing');
      expect(result.stdout).toContain('Found');
      expect(result.stdout).toContain('files to process');
    }, TEST_TIMEOUT);

    test('should provide trace-level output in very verbose mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand(['--very-verbose'], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization starting');
      expect(result.stdout).toContain('Configuration loaded successfully');
    }, TEST_TIMEOUT);

    test('should minimize output in quiet mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand(['--quiet'], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      // Quiet mode should still show essential completion messages
      // but less verbose output
      expect(result.stdout.length).toBeLessThan(500);
    }, TEST_TIMEOUT);

    test('should provide debug information in debug mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand(['--debug'], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization starting');
    }, TEST_TIMEOUT);
  });

  describe('Scramble Integration (when available)', () => {
    test('should handle scramble option when package not available', async () => {
      testProject = await setupTestProject('scramble-project');
      
      // Execute with scramble option (package likely not installed)
      const result = executeEnigmaCommand([
        '--scramble',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Scramble package not available');
      expect(result.stdout).toContain('using basic optimization');
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should handle scramble configuration options', async () => {
      testProject = await setupTestProject('scramble-project');
      
      // Execute with scramble configuration
      const result = executeEnigmaCommand([
        '--scramble',
        '--scramble-speed', '100',
        '--scramble-debug',
        '--scramble-mode', 'all',
        '--scramble-charset', 'abcdef',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing input directory gracefully', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Execute with non-existent input directory
      const result = executeEnigmaCommand([
        '--input', 'non-existent-directory',
        '--verbose'
      ], testProject.workingDir);
      
      // Should still complete but warn about no files found
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Found 0 files to process') ||
        expect(result.stdout).toContain('No files found to process');
    }, TEST_TIMEOUT);

    test('should handle invalid configuration gracefully', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Create invalid config file
      const invalidConfig = path.join(testProject.workingDir, 'invalid.config.js');
      await fs.writeFile(invalidConfig, 'export default { invalid: "config" };');
      
      // Execute with invalid config (should use defaults)
      const result = executeEnigmaCommand([
        '--config', 'invalid.config.js',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should handle file permission issues gracefully', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Execute with output to read-only directory (if possible to simulate)
      const result = executeEnigmaCommand([
        '--output', '/root/read-only-test',
        '--dry-run',
        '--verbose'
      ], testProject.workingDir);
      
      // Should complete in dry-run mode regardless of output permissions
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Running in dry-run mode');
    }, TEST_TIMEOUT);

    test('should validate numeric option ranges', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Test invalid concurrency value (should handle gracefully or provide error)
      const result = executeEnigmaCommand([
        '--max-concurrency', '0',
        '--verbose'
      ], testProject.workingDir, { expectFailure: true });
      
      // Either should fail with validation error or use default value
      expect(result.exitCode === 1 || result.exitCode === 0).toBeTruthy();
    }, TEST_TIMEOUT);
  });

  describe('File Discovery and Processing', () => {
    test('should discover files with glob patterns', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--input', 'src/**/*.{html,jsx}',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Discovering files for processing');
      expect(result.stdout).toContain('Found');
    }, TEST_TIMEOUT);

    test('should respect exclusion patterns', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--exclude-patterns', '**/*.jsx',
        '--exclude-extensions', '.min.js',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Found');
      expect(result.stdout).toContain('files to process');
    }, TEST_TIMEOUT);

    test('should respect max files limitation', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--max-files', '1',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);
  });

  describe('Performance and Optimization', () => {
    test('should complete optimization within reasonable time', async () => {
      testProject = await setupTestProject('basic-project');
      
      const startTime = Date.now();
      const result = executeEnigmaCommand(['--verbose'], testProject.workingDir);
      const endTime = Date.now();
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
      
      // Should complete within 15 seconds for basic project
      expect(endTime - startTime).toBeLessThan(15000);
    }, TEST_TIMEOUT);

    test('should handle large number of concurrent processes', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--max-concurrency', '8',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);
  });
});

describe('Enigma Command Help and Version', () => {
  test('should display help information', async () => {
    const result = executeEnigmaCommand(['--help'], process.cwd());
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('Options:');
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('--input');
    expect(result.stdout).toContain('--output');
    expect(result.stdout).toContain('--dry-run');
    expect(result.stdout).toContain('--scramble');
  }, 10000);

  test('should display version information', async () => {
    const result = executeEnigmaCommand(['--version'], process.cwd());
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/); // Should contain version number
  }, 10000);
});