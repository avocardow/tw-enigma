/**
 * Specialized Tests for Enigma Command Dry Run and Verbose Modes
 * 
 * These tests focus specifically on the dry run and verbose functionality
 * to ensure they behave correctly and provide expected output.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

// Test configuration
const TEST_TIMEOUT = 20000; // 20 seconds for focused tests
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
  const workingDir = path.join(__dirname, `../test-temp/dry-run-${projectName}-${Date.now()}`);
  
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
  options: { expectFailure?: boolean; timeout?: number } = {}
): { stdout: string; stderr: string; exitCode: number } {
  const { expectFailure = false, timeout = TEST_TIMEOUT } = options;
  
  try {
    const result = execSync(
      `node -r ts-node/register ${CLI_PATH} ${args.join(' ')}`,
      {
        cwd,
        encoding: 'utf8',
        timeout,
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

async function getFileModificationTime(filePath: string): Promise<number | null> {
  try {
    const stats = await fs.stat(filePath);
    return stats.mtimeMs;
  } catch {
    return null;
  }
}

async function getFileChecksum(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return Buffer.from(content).toString('base64');
  } catch {
    return null;
  }
}

describe('Enigma Dry Run Mode Tests', () => {
  let testProject: TestProject;

  afterEach(async () => {
    if (testProject) {
      await testProject.cleanup();
    }
  });

  describe('File Preservation in Dry Run Mode', () => {
    test('should not modify any files in dry run mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Get initial file states
      const htmlFile = path.join(testProject.workingDir, 'src/index.html');
      const jsxFile = path.join(testProject.workingDir, 'src/components/Button.jsx');
      
      const initialHtmlChecksum = await getFileChecksum(htmlFile);
      const initialJsxChecksum = await getFileChecksum(jsxFile);
      const initialHtmlMtime = await getFileModificationTime(htmlFile);
      const initialJsxMtime = await getFileModificationTime(jsxFile);
      
      // Execute in dry run mode
      const result = executeEnigmaCommand(['--dry-run'], testProject.workingDir);
      
      // Verify command succeeded
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Running in dry-run mode');
      expect(result.stdout).toContain('no files will be modified');
      
      // Verify files were not changed
      const finalHtmlChecksum = await getFileChecksum(htmlFile);
      const finalJsxChecksum = await getFileChecksum(jsxFile);
      const finalHtmlMtime = await getFileModificationTime(htmlFile);
      const finalJsxMtime = await getFileModificationTime(jsxFile);
      
      expect(finalHtmlChecksum).toBe(initialHtmlChecksum);
      expect(finalJsxChecksum).toBe(initialJsxChecksum);
      expect(finalHtmlMtime).toBe(initialHtmlMtime);
      expect(finalJsxMtime).toBe(initialJsxMtime);
    }, TEST_TIMEOUT);

    test('should not create output files in dry run mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const outputDir = path.join(testProject.workingDir, 'dist');
      
      // Ensure output directory doesn't exist initially
      await fs.remove(outputDir);
      
      // Execute in dry run mode
      const result = executeEnigmaCommand([
        '--dry-run',
        '--output', 'dist'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Running in dry-run mode');
      
      // Verify no output files were created
      const outputExists = await fs.pathExists(outputDir);
      expect(outputExists).toBe(false);
    }, TEST_TIMEOUT);

    test('should process configuration and show analysis in dry run', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--dry-run',
        '--config', 'enigma.config.js'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Running in dry-run mode');
      expect(result.stdout).toContain('Configuration loaded successfully');
      expect(result.stdout).toContain('Core optimization engine working');
    }, TEST_TIMEOUT);
  });

  describe('Dry Run Output and Reporting', () => {
    test('should show what would be optimized in dry run', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--dry-run',
        '--verbose'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Running in dry-run mode');
      expect(result.stdout).toContain('Discovering files for processing');
      expect(result.stdout).toContain('Found');
      expect(result.stdout).toContain('files to process');
      expect(result.stdout).toContain('Enigma optimization complete');
    }, TEST_TIMEOUT);

    test('should handle scramble options in dry run mode', async () => {
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
});

describe('Enigma Verbose Mode Tests', () => {
  let testProject: TestProject;

  afterEach(async () => {
    if (testProject) {
      await testProject.cleanup();
    }
  });

  describe('Verbose Output Levels', () => {
    test('should provide detailed logging in verbose mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand(['--verbose'], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      
      // Check for expected verbose output sections
      const expectedSections = [
        'Enigma optimization starting',
        'Configuration loaded successfully',
        'Testing core optimization engine',
        'Discovering files for processing',
        'Found',
        'files to process',
        'Checking scramble package availability',
        'Enigma optimization complete'
      ];
      
      expectedSections.forEach(section => {
        expect(result.stdout).toContain(section);
      });
    }, TEST_TIMEOUT);

    test('should provide more detailed output in very verbose mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand(['--very-verbose'], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization starting');
      expect(result.stdout).toContain('Configuration loaded successfully');
      
      // Very verbose should include all verbose output plus additional details
      expect(result.stdout.length).toBeGreaterThan(100);
    }, TEST_TIMEOUT);

    test('should show debug information in debug mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand(['--debug'], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Enigma optimization starting');
      expect(result.stdout).toContain('Configuration loaded successfully');
    }, TEST_TIMEOUT);

    test('should minimize output in quiet mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const verboseResult = executeEnigmaCommand(['--verbose'], testProject.workingDir);
      const quietResult = executeEnigmaCommand(['--quiet'], testProject.workingDir);
      
      expect(verboseResult.exitCode).toBe(0);
      expect(quietResult.exitCode).toBe(0);
      
      // Quiet mode should produce significantly less output
      expect(quietResult.stdout.length).toBeLessThan(verboseResult.stdout.length / 2);
    }, TEST_TIMEOUT);
  });

  describe('Verbose Configuration Details', () => {
    test('should show configuration details in verbose mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--verbose',
        '--config', 'enigma.config.js'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration loaded successfully');
    }, TEST_TIMEOUT);

    test('should show file discovery details in verbose mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--verbose',
        '--include-file-types', 'HTML', 'JAVASCRIPT'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Discovering files for processing');
      expect(result.stdout).toContain('Found');
    }, TEST_TIMEOUT);

    test('should show optimization details in verbose mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--verbose',
        '--minify',
        '--source-maps'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Core optimization engine working');
      expect(result.stdout).toContain('classes processed');
    }, TEST_TIMEOUT);
  });

  describe('Verbose Error Reporting', () => {
    test('should provide detailed error information in verbose mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      // Execute with potentially problematic configuration
      const result = executeEnigmaCommand([
        '--verbose',
        '--input', 'non-existent-directory'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0); // Should handle gracefully
      expect(result.stdout).toContain('Found 0 files to process') ||
        expect(result.stdout).toContain('No files found to process');
    }, TEST_TIMEOUT);

    test('should show scramble package detection in verbose mode', async () => {
      testProject = await setupTestProject('basic-project');
      
      const result = executeEnigmaCommand([
        '--verbose',
        '--scramble'
      ], testProject.workingDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Checking scramble package availability');
      expect(result.stdout).toContain('Scramble package not available') ||
        expect(result.stdout).toContain('Scramble package detected');
    }, TEST_TIMEOUT);
  });
});

describe('Combined Dry Run and Verbose Mode Tests', () => {
  let testProject: TestProject;

  afterEach(async () => {
    if (testProject) {
      await testProject.cleanup();
    }
  });

  test('should combine dry run safety with verbose detail', async () => {
    testProject = await setupTestProject('basic-project');
    
    // Get initial file states
    const htmlFile = path.join(testProject.workingDir, 'src/index.html');
    const initialChecksum = await getFileChecksum(htmlFile);
    
    // Execute with both dry run and verbose
    const result = executeEnigmaCommand([
      '--dry-run',
      '--verbose'
    ], testProject.workingDir);
    
    expect(result.exitCode).toBe(0);
    
    // Should have dry run safety
    expect(result.stdout).toContain('Running in dry-run mode');
    expect(result.stdout).toContain('no files will be modified');
    
    // Should have verbose detail
    expect(result.stdout).toContain('Configuration loaded successfully');
    expect(result.stdout).toContain('Discovering files for processing');
    expect(result.stdout).toContain('Found');
    expect(result.stdout).toContain('Enigma optimization complete');
    
    // Files should remain unchanged
    const finalChecksum = await getFileChecksum(htmlFile);
    expect(finalChecksum).toBe(initialChecksum);
  }, TEST_TIMEOUT);

  test('should show complete workflow in dry run verbose mode', async () => {
    testProject = await setupTestProject('scramble-project');
    
    const result = executeEnigmaCommand([
      '--dry-run',
      '--very-verbose',
      '--scramble',
      '--minify',
      '--source-maps'
    ], testProject.workingDir);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Running in dry-run mode');
    expect(result.stdout).toContain('Enigma optimization starting');
    expect(result.stdout).toContain('Configuration loaded successfully');
    expect(result.stdout).toContain('Enigma optimization complete');
  }, TEST_TIMEOUT);

  test('should handle all logging options in dry run mode', async () => {
    testProject = await setupTestProject('basic-project');
    
    const result = executeEnigmaCommand([
      '--dry-run',
      '--debug',
      '--log-level', 'debug'
    ], testProject.workingDir);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Running in dry-run mode');
    expect(result.stdout).toContain('Enigma optimization complete');
  }, TEST_TIMEOUT);
});