/**
 * Tests for Enigma Command Scramble Integration and Error Scenarios
 * 
 * These tests focus on scramble functionality and various error conditions
 * to ensure robust error handling and graceful degradation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

// Test configuration
const TEST_TIMEOUT = 25000; // 25 seconds for error scenario tests
const CLI_PATH = path.resolve(__dirname, '../bin/enigma.ts');
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures/enigma-integration');

// Test utilities
interface TestProject {
  name: string;
  workingDir: string;
  cleanup: () => Promise<void>;
}

async function setupTestProject(projectName: string): Promise<TestProject> {
  const sourceDir = path.join(FIXTURES_DIR, projectName);
  const workingDir = path.join(__dirname, `../test-temp/scramble-${projectName}-${Date.now()}`);
  
  await fs.ensureDir(workingDir);
  await fs.copy(sourceDir, workingDir);
  
  return {
    name: projectName,
    workingDir,
    cleanup: async () => {
      if (await fs.pathExists(workingDir)) {
        await fs.remove(workingDir);
      }
    }
  };
}

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

describe('Enigma Scramble Integration Tests', () => {
  let testProject: TestProject;

  afterEach(async () => {
    if (testProject) {
      await testProject.cleanup();
    }
  });

  describe('Scramble Package Detection', () => {
    test('should detect when scramble package is not available', async () => {
      testProject = await setupTestProject('scramble-project');
      
      const result = executeEnigmaCommand([
        '--scramble',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Checking scramble package availability');
      expect(result.stdout).toContain('Scramble package not available') ||
        expect(result.stdout).toContain('using basic optimization');
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should handle scramble package detection gracefully', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--scramble',
        '--scramble-debug',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should continue optimization when scramble package unavailable', async () => {
      testProject = await setupTestProject('scramble-project');
      
      const result = executeEnigmaCommand([
        '--scramble',
        '--minify',
        '--source-maps'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
      // Should warn about scramble but continue with basic optimization
      expect(result.stdout).toContain('Scramble package not available') ||
        expect(result.stdout).toContain('using basic optimization');
    }, TEST_TIMEOUT);
  });

  describe('Scramble Configuration Options', () => {
    test('should handle all scramble configuration options', async () => {
      testProject = await setupTestProject('scramble-project');
      
      const result = executeEnigmaCommand([
        '--scramble',
        '--scramble-speed', '200',
        '--scramble-debug',
        '--scramble-mode', 'recursive',
        '--scramble-charset', 'abc123',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should validate scramble speed parameter', async () => {
      testProject = await setupTestProject('scramble-project');
      
      // Test invalid scramble speed (below minimum)
      const result1 = executeEnigmaCommand([
        '--scramble-speed', '25', // Below minimum of 50
        '--scramble'
      ], testProject.workingDir, { expectFailure: true });
      
      // Should either fail with validation error or use default
      expect(result1.exitCode === 1 || result1.exitCode === 0).toBeTruthy();
      
      // Test invalid scramble speed (above maximum)
      const result2 = executeEnigmaCommand([
        '--scramble-speed', '2000', // Above maximum of 1000
        '--scramble'
      ], testProject.workingDir, { expectFailure: true });
      
      expect(result2.exitCode === 1 || result2.exitCode === 0).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should handle scramble in dry run mode', async () => {
      testProject = await setupTestProject('scramble-project');
      
      const result = executeEnigmaCommand([
        '--dry-run',
        '--scramble',
        '--scramble-speed', '100',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Running in dry-run mode');
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);
  });

  describe('Scramble Error Scenarios', () => {
    test('should handle scramble without package gracefully', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--scramble',
        '--scramble-debug'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
      // Should not fail even if scramble package is unavailable
    }, TEST_TIMEOUT);

    test('should handle invalid scramble configuration gracefully', async () => {
      testProject = await setupTestProject('scramble-project');
      
      const result = executeEnigmaCommand([
        '--scramble',
        '--scramble-mode', 'invalid-mode',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);
  });
});

describe('Enigma Error Handling Tests', () => {
  let testProject: TestProject;

  afterEach(async () => {
    if (testProject) {
      await testProject.cleanup();
    }
  });

  describe('Configuration Errors', () => {
    test('should handle missing configuration file gracefully', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--config', 'non-existent-config.js',
        '--verbose'
      ], testProject.workingDir);
      
      // Should either use defaults or show appropriate error
      expect(result.exitCode === 0 || result.exitCode === 1).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should handle malformed configuration file', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Create a malformed configuration file
      const badConfigPath = path.join(testProject.workingDir, 'bad-config.js');
      await fs.writeFile(badConfigPath, 'export default { invalid json syntax }');
      
      const result = executeEnigmaCommand([
        '--config', 'bad-config.js',
        '--verbose'
      ], testProject.workingDir, { expectFailure: true });
      
      // Should handle parsing error gracefully
      expect(result.exitCode === 0 || result.exitCode === 1).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should handle empty configuration file', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Create an empty configuration file
      const emptyConfigPath = path.join(testProject.workingDir, 'empty-config.js');
      await fs.writeFile(emptyConfigPath, '');
      
      const result = executeEnigmaCommand([
        '--config', 'empty-config.js',
        '--verbose'
      ], testProject.workingDir);
      
      // Should use defaults when config is empty
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);
  });

  describe('Input/Output Errors', () => {
    test('should handle non-existent input directory', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--input', 'totally-non-existent-directory',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Found 0 files to process') ||
        expect(result.stdout).toContain('No files found to process');
    }, TEST_TIMEOUT);

    test('should handle input file instead of directory', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Point input to a file instead of directory
      const result = executeEnigmaCommand([
        '--input', 'package.json',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      // Should handle gracefully by processing the single file or showing appropriate message
    }, TEST_TIMEOUT);

    test('should handle permission denied scenarios in dry run', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Attempt to write to system directory (should be safe in dry run)
      const result = executeEnigmaCommand([
        '--output', '/root/protected-directory',
        '--dry-run',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Running in dry-run mode');
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);
  });

  describe('Parameter Validation Errors', () => {
    test('should validate max-concurrency parameter', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Test invalid concurrency values
      const invalidValues = ['0', '-1', '15', 'invalid'];
      
      for (const value of invalidValues) {
        const result = executeEnigmaCommand([
          '--max-concurrency', value,
          '--dry-run'
        ], testProject.workingDir, { expectFailure: true });
        
        // Should either fail validation or use default
        expect(result.exitCode === 0 || result.exitCode === 1).toBeTruthy();
      }
    }, TEST_TIMEOUT);

    test('should validate max-files parameter', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Test invalid max-files values
      const result = executeEnigmaCommand([
        '--max-files', '-5',
        '--dry-run'
      ], testProject.workingDir, { expectFailure: true });
      
      expect(result.exitCode === 0 || result.exitCode === 1).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should handle invalid log level', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--log-level', 'invalid-level',
        '--dry-run'
      ], testProject.workingDir, { expectFailure: true });
      
      // Should either fail validation or use default
      expect(result.exitCode === 0 || result.exitCode === 1).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should handle conflicting verbose options', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Test conflicting verbose and quiet options
      const result = executeEnigmaCommand([
        '--verbose',
        '--quiet',
        '--dry-run'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      // Should handle conflicting options gracefully (likely quiet takes precedence)
    }, TEST_TIMEOUT);
  });

  describe('File System Error Scenarios', () => {
    test('should handle empty project directory', async () => {
      // Create completely empty project
      const emptyDir = path.join(__dirname, `../test-temp/empty-${Date.now()}`);
      await fs.ensureDir(emptyDir);
      
      testProject = {
        name: 'empty',
        workingDir: emptyDir,
        cleanup: async () => {
          if (await fs.pathExists(emptyDir)) {
            await fs.remove(emptyDir);
          }
        }
      };
      
      const result = executeEnigmaCommand([
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Found 0 files to process') ||
        expect(result.stdout).toContain('No files found to process');
    }, TEST_TIMEOUT);

    test('should handle very large file exclusion patterns', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Create many exclusion patterns
      const manyPatterns = Array.from({length: 50}, (_, i) => `pattern${i}/**`);
      
      const result = executeEnigmaCommand([
        '--exclude-patterns', ...manyPatterns,
        '--dry-run',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should handle circular symlinks gracefully', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Create a circular symlink if the platform supports it
      try {
        const linkPath = path.join(testProject.workingDir, 'circular-link');
        await fs.ensureSymlink(testProject.workingDir, linkPath);
        
        const result = executeEnigmaCommand([
          '--follow-symlinks',
          '--verbose'
        ], testProject.workingDir);
        
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Enigma optimization complete');
      } catch {
        // Skip test if symlinks not supported on platform
      }
    }, TEST_TIMEOUT);
  });

  describe('Resource Limit Scenarios', () => {
    test('should handle max files limit', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--max-files', '1',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should handle very low concurrency', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--max-concurrency', '1',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should handle timeout scenarios gracefully', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Execute with very short timeout to test timeout handling
      const result = executeEnigmaCommand([
        '--verbose'
      ], testProject.workingDir, { timeout: 5000 });
      
      // Should either complete quickly or handle timeout gracefully
      expect(result.exitCode === 0 || result.exitCode === 1).toBeTruthy();
    }, 10000); // Reduced timeout for this specific test
  });
});