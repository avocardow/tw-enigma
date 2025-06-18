import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI_PATH = join(process.cwd(), 'dist', 'enigma.js');

// Enhanced helper function with CI debugging
function runCLI(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve, reject) => {
    // Verify CLI file exists before running
    if (!existsSync(CLI_PATH)) {
      const error = new Error(`CLI file does not exist: ${CLI_PATH}. Run 'npm run build' first.`);
      reject(error);
      return;
    }

    // Enhanced environment for CI debugging
    const testEnv = {
      ...process.env,
      NODE_ENV: 'test',
      DEBUG_CLI: 'true', // Enable CLI debugging in tests
      CI: process.env.CI || 'false', // Preserve CI flag
      FORCE_COLOR: '0', // Disable colors in CI for consistent output
    };

    // Log test execution details in CI
    if (process.env.CI) {
      console.log(`[CI DEBUG] Running CLI test: node ${CLI_PATH} ${args.join(' ')}`);
      console.log(`[CI DEBUG] Working directory: ${process.cwd()}`);
      console.log(`[CI DEBUG] Node version: ${process.version}`);
      console.log(`[CI DEBUG] Platform: ${process.platform} ${process.arch}`);
    }

    const child = spawn('node', [CLI_PATH, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: testEnv,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      // Log stdout in real-time for CI debugging
      if (process.env.CI) {
        console.log(`[CI DEBUG] STDOUT: ${chunk.trim()}`);
      }
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      // Log stderr in real-time for CI debugging
      if (process.env.CI) {
        console.log(`[CI DEBUG] STDERR: ${chunk.trim()}`);
      }
    });

    child.on('error', (error) => {
      if (process.env.CI) {
        console.log(`[CI DEBUG] Child process error: ${error.message}`);
        console.log(`[CI DEBUG] Error details:`, error);
      }
      reject(error);
    });

    child.on('close', (code, signal) => {
      if (process.env.CI) {
        console.log(`[CI DEBUG] Process closed with code: ${code}, signal: ${signal}`);
        console.log(`[CI DEBUG] Final stdout length: ${stdout.length}`);
        console.log(`[CI DEBUG] Final stderr length: ${stderr.length}`);
        if (stdout) console.log(`[CI DEBUG] Final stdout content: ${stdout}`);
        if (stderr) console.log(`[CI DEBUG] Final stderr content: ${stderr}`);
      }

      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
      });
    });

    // Enhanced timeout protection for CI with longer timeout
    const timeoutMs = process.env.CI ? 45000 : 30000; // 45s for CI, 30s for local
    setTimeout(() => {
      if (process.env.CI) {
        console.log(`[CI DEBUG] Test timeout after ${timeoutMs}ms, killing process`);
      }
      child.kill('SIGTERM');
      setTimeout(() => {
        child.kill('SIGKILL');
      }, 5000);
      reject(new Error(`CLI command timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });
}

describe('Enhanced CLI Tests', () => {
  beforeEach(async () => {
    // Ensure CLI is built before tests
    if (!existsSync(CLI_PATH)) {
      throw new Error(`CLI not built: ${CLI_PATH} does not exist. Run 'npm run build' first.`);
    }

    // Log environment info in CI
    if (process.env.CI) {
      console.log(`[CI DEBUG] Test environment check passed`);
      console.log(`[CI DEBUG] CLI path exists: ${CLI_PATH}`);
    }
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('Help and Version', () => {
    it('should display help information', async () => {
      const result = await runCLI(['--help']);

      // Enhanced debugging for failures
      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Help test failed with exit code ${result.exitCode}`);
        console.log(`[CI DEBUG] Expected: exit code 0`);
        console.log(
          `[CI DEBUG] Stdout contains new branding: ${result.stdout.includes('🎨 @tw-enigma/cli')}`
        );
        console.log(
          `[CI DEBUG] Stdout contains Usage: ${result.stdout.includes('Usage: enigma [options]')}`
        );
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🎨 @tw-enigma/cli');
      expect(result.stdout).toContain('Usage: enigma [options]');
      expect(result.stdout).toContain('--pretty');
      expect(result.stdout).toContain('--config');
      expect(result.stdout).toContain('--verbose');
      expect(result.stdout).toContain('--debug');
      expect(result.stdout).toContain('--input');
      expect(result.stdout).toContain('--output');
      expect(result.stdout).toContain('--length');
      expect(result.stdout).toContain('Minimum class name length (1-26)');
    });

    it('should display version information', async () => {
      const result = await runCLI(['--version']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Version test failed with exit code ${result.exitCode}`);
        console.log(`[CI DEBUG] Expected: exit code 0`);
        console.log(`[CI DEBUG] Stdout contains version: ${result.stdout.includes('1.0.1')}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('1.0.1');
    });

    it('should display version with -v flag', async () => {
      const result = await runCLI(['-v']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Version -v test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('1.0.1');
    });

    it('should display help with -h flag', async () => {
      const result = await runCLI(['-h']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Help -h test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage: enigma [options]');
    });
  });

  describe('Configuration System Integration', () => {
    it('should run with default configuration', async () => {
      const result = await runCLI([]);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Default config test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🎨 @tw-enigma/cli');
      expect(result.stdout).toContain('Usage: enigma [options]');
    });

    it('should enable pretty mode with --pretty flag', async () => {
      const result = await runCLI(['--pretty']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Pretty mode test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        'Pretty mode enabled - output will be formatted for readability'
      );
    });

    it('should enable pretty mode with -p flag', async () => {
      const result = await runCLI(['-p']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Pretty mode -p test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        'Pretty mode enabled - output will be formatted for readability'
      );
    });

    it('should enable verbose mode', async () => {
      const result = await runCLI(['--verbose']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Verbose mode test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration loaded successfully');
    });

    it('should enable debug mode', async () => {
      const result = await runCLI(['--debug']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Debug mode test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Debug mode enabled');
      expect(result.stdout).toContain('Final configuration:');
    });

    it('should handle input and output options', async () => {
      const result = await runCLI([
        '--input',
        './test-src',
        '--output',
        './test-dist',
        '--verbose',
      ]);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Input/Output test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Input configured');
      expect(result.stdout).toContain('Output configured');
    });

    it('should work with multiple flags combined', async () => {
      const result = await runCLI(['--pretty', '--verbose', '--input', './src']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Multiple flags test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Pretty mode enabled');
      expect(result.stdout).toContain('Configuration loaded successfully');
      expect(result.stdout).toContain('Input configured');
    });
  });

  describe('Configuration File Handling', () => {
    it('should handle missing config file gracefully', async () => {
      const result = await runCLI(['--config', 'nonexistent.config.js']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Missing config test failed with exit code ${result.exitCode}`);
      }

      // Should gracefully fall back to defaults instead of failing
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Failed to load configuration file');
      expect(result.stdout).toContain('Configuration loaded successfully');
    });

    it('should accept config file with --config flag', async () => {
      // This test expects the config file to not exist, so it should fail gracefully
      const result = await runCLI(['--config', 'test.config.js']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Config --config test failed with exit code ${result.exitCode}`);
      }

      // Should gracefully fall back to defaults instead of failing
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Failed to load configuration file');
      expect(result.stdout).toContain('Configuration loaded successfully');
    });

    it('should accept config file with -c flag', async () => {
      // This test expects the config file to not exist, so it should fail gracefully
      const result = await runCLI(['-c', 'custom.config.js']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Config -c test failed with exit code ${result.exitCode}`);
      }

      // Should gracefully fall back to defaults instead of failing
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Failed to load configuration file');
      expect(result.stdout).toContain('Configuration loaded successfully');
    });
  });

  describe('Commands', () => {
    it('should provide init-config command', async () => {
      const result = await runCLI(['init-config']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Init-config test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Sample configuration file content');
      expect(result.stdout).toContain('module.exports = {');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown flags gracefully', async () => {
      const result = await runCLI(['--unknown-flag']);

      if (process.env.CI) {
        console.log(`[CI DEBUG] Unknown flag test result: exit code ${result.exitCode}`);
        console.log(`[CI DEBUG] Expected: exit code 1 (commander.js error handling)`);
      }

      // Commander.js handles unknown flags by showing error and exiting with code 1
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("error: unknown option '--unknown-flag'");
    });

    it('should handle unknown commands gracefully', async () => {
      const result = await runCLI(['unknown-command']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Unknown command test failed with exit code ${result.exitCode}`);
      }

      // commander.js handles unknown commands by treating them as positional arguments
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🎨 @tw-enigma/cli');
    });
  });

  describe('Length Option', () => {
    it('should accept valid length values', async () => {
      const result = await runCLI(['--length', '10']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Valid length test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Minimum class name length: 10');
    });

    it('should accept minimum valid length (1)', async () => {
      const result = await runCLI(['--length', '1']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Minimum length test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Minimum class name length: 1');
    });

    it('should accept maximum valid length (26)', async () => {
      const result = await runCLI(['--length', '26']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Maximum length test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Minimum class name length: 26');
    });

    it('should reject length value below 1', async () => {
      const result = await runCLI(['--length', '0']);

      if (process.env.CI) {
        console.log(`[CI DEBUG] Below minimum length test result: exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'Invalid length value: 0. Must be a number between 1 and 26.'
      );
    });

    it('should reject length value above 26', async () => {
      const result = await runCLI(['--length', '27']);

      if (process.env.CI) {
        console.log(`[CI DEBUG] Above maximum length test result: exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'Invalid length value: 27. Must be a number between 1 and 26.'
      );
    });

    it('should reject non-numeric length values', async () => {
      const result = await runCLI(['--length', 'abc']);

      if (process.env.CI) {
        console.log(`[CI DEBUG] Non-numeric length test result: exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'Invalid length value: abc. Must be a number between 1 and 26.'
      );
    });

    it('should reject negative length values', async () => {
      const result = await runCLI(['--length', '-5']);

      if (process.env.CI) {
        console.log(`[CI DEBUG] Negative length test result: exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'Invalid length value: -5. Must be a number between 1 and 26.'
      );
    });

    it('should include length in debug output', async () => {
      const result = await runCLI(['--debug', '--length', '15']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Length debug test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Debug mode enabled');
      expect(result.stdout).toContain('"length": 15');
    });
  });

  describe('Advanced Configuration Options', () => {
    it('should handle all configuration options', async () => {
      const result = await runCLI([
        '--debug',
        '--verbose',
        '--pretty',
        '--input',
        './src',
        '--output',
        './dist',
        '--format',
        'json',
        '--max-concurrency',
        '4',
      ]);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] All config options test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Debug mode enabled');
      expect(result.stdout).toContain('Final configuration:');
    });

    it('should handle exclude patterns', async () => {
      const result = await runCLI([
        '--debug',
        '--exclude-patterns',
        '*.test.js',
        '*.spec.js',
        '--input',
        './src',
      ]);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Exclude patterns test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Final configuration:');
      expect(result.stdout).toContain('"excludePatterns"');
    });
  });

  describe('Output Formatting', () => {
    it('should show helpful tips when no input specified', async () => {
      const result = await runCLI([]);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] Tips test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🎨 @tw-enigma/cli');
      expect(result.stdout).toContain('Usage: enigma [options]');
    });

    it('should not show tips when input is specified', async () => {
      const result = await runCLI(['--input', './src']);

      if (result.exitCode !== 0 && process.env.CI) {
        console.log(`[CI DEBUG] No tips test failed with exit code ${result.exitCode}`);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain('Tip: Use --input to specify files to process');
    });
  });
});
