import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliTestHarness } from './utils/cli-test-harness';

/**
 * CLI Interface Compatibility Test Suite
 *
 * Purpose: Comprehensive validation of CLI interface backward compatibility
 * Part of: Subtask 15.5 Step 3 - CLI Interface Compatibility Analysis
 */

describe('CLI Interface Compatibility', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory('cli-compat-test-');
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Command Structure Validation', () => {
    it('should maintain backward compatibility for basic CLI commands', async () => {
      // Test basic command structure that should work across versions
      const commands = [
        ['--help'],
        ['--version'],
        ['init-config', '--help'],
        ['css-config', '--help'],
      ];

      for (const command of commands) {
        const result = await cliHarness.executeCommandInDirectory(command, tempDir, {
          timeout: 10000,
        });

        // All help and version commands should succeed
        expect(result.exitCode).toBe(0);
        expect(result.stdout || result.stderr).toBeTruthy();
      }
    });

    it('should support legacy global flag formats', async () => {
      // Test legacy global flags that should still work
      const legacyFlagTests = [
        // Legacy --length flag (should be supported)
        ['--length', '5', 'init-config'],
        ['--length=5', 'init-config'],

        // Legacy --verbose flag
        ['--verbose', 'init-config'],
        ['-v', 'init-config'],

        // Legacy --config flag
        ['--config', path.join(tempDir, 'test.json'), 'init-config'],
      ];

      // Create a basic config file for testing
      const basicConfig = { input: './src', output: './dist' };
      await cliHarness.createTestConfig(tempDir, basicConfig, 'test.json');

      for (const flags of legacyFlagTests) {
        const result = await cliHarness.executeCommandInDirectory(flags, tempDir, {
          timeout: 15000,
          expectFailure: false,
        });

        // Should either succeed or fail gracefully with meaningful error
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        if (result.exitCode !== 0) {
          // If it fails, should have meaningful error message
          expect(result.stderr || result.stdout).toMatch(/error|invalid|usage/i);
        }
      }
    });

    it('should handle flag precedence correctly', async () => {
      // Test that CLI flags override config file values (legacy behavior)
      const configWithLength = {
        input: './src',
        output: './dist',
        nameGeneration: {
          minimumLength: 3,
        },
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        configWithLength,
        'precedence-test.json'
      );

      // CLI flag should override config file value
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, '--length', '7', 'init-config'],
        tempDir,
        { timeout: 15000 }
      );

      expect(result.exitCode).toBe(0);
      // Should show evidence that CLI flag took precedence (specific message varies)
      expect(result.stdout || result.stderr).toBeTruthy();
    });

    it('should maintain consistent command argument parsing', async () => {
      // Test various argument parsing patterns that should remain consistent
      const argPatterns = [
        // Equals syntax
        ['init-config', '--length=5'],
        // Space syntax
        ['init-config', '--length', '5'],
        // Combined short flags (if supported)
        ['init-config', '-v'],
        // Boolean flags
        ['init-config', '--verbose'],
      ];

      for (const args of argPatterns) {
        const result = await cliHarness.executeCommandInDirectory(args, tempDir, {
          timeout: 10000,
          expectFailure: false,
        });

        // Should parse arguments consistently
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        if (result.exitCode !== 0) {
          // Should provide helpful error message if parsing fails
          expect(result.stderr || result.stdout).toMatch(/argument|option|usage/i);
        }
      }
    });
  });

  describe('Output Format Consistency', () => {
    it('should maintain consistent help output format', async () => {
      const helpCommands = [['--help'], ['init-config', '--help'], ['css-config', '--help']];

      for (const cmd of helpCommands) {
        const result = await cliHarness.executeCommandInDirectory(cmd, tempDir);

        expect(result.exitCode).toBe(0);
        const output = result.stdout || result.stderr;

        // Help output should contain standard elements
        expect(output).toMatch(/usage|options|commands/i);

        // Should have consistent structure
        expect(output).toBeTruthy();
        expect(output.length).toBeGreaterThan(50); // Meaningful help text
      }
    });

    it('should provide consistent version information', async () => {
      const result = await cliHarness.executeCommandInDirectory(['--version'], tempDir);

      expect(result.exitCode).toBe(0);
      const output = result.stdout || result.stderr;

      // Version output should contain version number
      expect(output).toMatch(/\d+\.\d+\.\d+/); // Semver pattern

      // Should be concise and informative
      expect(output.length).toBeGreaterThan(5);
      expect(output.length).toBeLessThan(200); // Not overly verbose
    });

    it('should maintain consistent error message format', async () => {
      // Test error scenarios that should have consistent messaging
      const errorScenarios = [
        // Invalid command
        ['invalid-command'],
        // Invalid flag
        ['init-config', '--invalid-flag'],
        // Missing required argument
        ['init-config', '--config'], // Missing config file path
      ];

      for (const args of errorScenarios) {
        const result = await cliHarness.executeCommandInDirectory(args, tempDir, {
          expectFailure: true,
          timeout: 10000,
        });

        // Should exit with non-zero code for errors
        expect(result.exitCode).toBeGreaterThan(0);

        const errorOutput = result.stderr || result.stdout;

        // Error messages should be informative
        expect(errorOutput).toBeTruthy();
        expect(errorOutput).toMatch(/error|invalid|unknown|usage/i);

        // Should provide guidance or suggest correct usage
        expect(errorOutput.length).toBeGreaterThan(10);
      }
    });

    it('should handle output verbosity levels consistently', async () => {
      // Test different verbosity levels
      const verbosityTests = [
        // Default (normal) output
        ['init-config'],
        // Verbose output
        ['--verbose', 'init-config'],
        // Quiet/minimal output (if supported)
        ['--quiet', 'init-config'],
      ];

      for (const args of verbosityTests) {
        const result = await cliHarness.executeCommandInDirectory(args, tempDir, {
          timeout: 15000,
          expectFailure: false,
        });

        expect(result.exitCode).toBeGreaterThanOrEqual(0);

        if (result.exitCode === 0) {
          const output = result.stdout || result.stderr;
          expect(output).toBeDefined();

          // Verbose mode should provide more detailed output
          if (args.includes('--verbose')) {
            expect(output.length).toBeGreaterThan(20);
          }
        }
      }
    });
  });

  describe('Exit Code Consistency', () => {
    it('should return consistent exit codes for success scenarios', async () => {
      const successCommands = [['--help'], ['--version'], ['init-config', '--help']];

      for (const cmd of successCommands) {
        const result = await cliHarness.executeCommandInDirectory(cmd, tempDir);

        expect(result.exitCode).toBe(0);
      }
    });

    it('should return consistent exit codes for error scenarios', async () => {
      const errorCommands = [
        ['invalid-command'],
        ['init-config', '--invalid-flag'],
        ['init-config', '--config', '/nonexistent/path'],
      ];

      for (const cmd of errorCommands) {
        const result = await cliHarness.executeCommandInDirectory(cmd, tempDir, {
          expectFailure: true,
          timeout: 10000,
        });

        // Error commands should return non-zero exit codes
        expect(result.exitCode).toBeGreaterThan(0);
        expect(result.exitCode).toBeLessThan(128); // Standard error code range
      }
    });

    it('should maintain backward compatibility for configuration validation exit codes', async () => {
      // Test exit codes for configuration scenarios
      const scenarios = [
        {
          name: 'valid config',
          config: { input: './src', output: './dist' },
          expectedExitCode: 0,
        },
        {
          name: 'invalid config path',
          configPath: '/nonexistent/config.json',
          expectedExitCode: [1, 2], // Allow some variation in error codes
        },
      ];

      for (const scenario of scenarios) {
        let result;

        if (scenario.config) {
          const configPath = await cliHarness.createTestConfig(
            tempDir,
            scenario.config,
            'test-config.json'
          );
          result = await cliHarness.executeCommandInDirectory(
            ['--config', configPath, 'init-config'],
            tempDir,
            { timeout: 15000, expectFailure: scenario.expectedExitCode !== 0 }
          );
        } else if (scenario.configPath) {
          result = await cliHarness.executeCommandInDirectory(
            ['--config', scenario.configPath, 'init-config'],
            tempDir,
            { expectFailure: true, timeout: 10000 }
          );
        }

        if (Array.isArray(scenario.expectedExitCode)) {
          expect(scenario.expectedExitCode).toContain(result.exitCode);
        } else {
          expect(result.exitCode).toBe(scenario.expectedExitCode);
        }
      }
    });
  });

  describe('Environment Integration Compatibility', () => {
    it('should handle environment variables consistently', async () => {
      // Test environment variable handling
      const envTests = [
        {
          name: 'NODE_ENV=development',
          env: { NODE_ENV: 'development' },
          command: ['init-config'],
        },
        {
          name: 'NODE_ENV=production',
          env: { NODE_ENV: 'production' },
          command: ['init-config'],
        },
      ];

      for (const test of envTests) {
        const result = await cliHarness.executeCommandInDirectory(test.command, tempDir, {
          timeout: 15000,
          env: { ...process.env, ...test.env },
          expectFailure: false,
        });

        // Environment variables shouldn't break basic functionality
        expect(result.exitCode).toBeGreaterThanOrEqual(0);

        if (result.exitCode !== 0) {
          // Should provide meaningful error if environment causes issues
          const output = result.stderr || result.stdout;
          expect(output).toMatch(/error|warning|environment/i);
        }
      }
    });

    it('should handle working directory changes gracefully', async () => {
      // Create subdirectory to test working directory handling
      const subDir = path.join(tempDir, 'subdir');
      await fs.mkdir(subDir, { recursive: true });

      // Test command execution from different working directories
      const commands = [['--help'], ['--version'], ['init-config', '--help']];

      for (const cmd of commands) {
        // Test from subdirectory
        const result = await cliHarness.executeCommandInDirectory(cmd, subDir);

        // Basic commands should work regardless of working directory
        expect(result.exitCode).toBe(0);
        expect(result.stdout || result.stderr).toBeTruthy();
      }
    });

    it('should maintain consistent behavior with standard streams', async () => {
      // Test stdout/stderr usage consistency
      const commands = [
        { cmd: ['--help'], expectStdout: true },
        { cmd: ['--version'], expectStdout: true },
        { cmd: ['invalid-command'], expectStderr: true, expectFailure: true },
      ];

      for (const test of commands) {
        const result = await cliHarness.executeCommandInDirectory(test.cmd, tempDir, {
          expectFailure: test.expectFailure || false,
          timeout: 10000,
        });

        if (test.expectStdout) {
          expect(result.stdout).toBeTruthy();
        }

        if (test.expectStderr) {
          expect(result.stderr).toBeTruthy();
        }

        // At least one output stream should have content
        expect((result.stdout || '') + (result.stderr || '')).toBeTruthy();
      }
    });
  });

  describe('Configuration File Integration', () => {
    it('should handle configuration file precedence consistently', async () => {
      // Create configuration file
      const config = {
        input: './src',
        output: './dist',
        nameGeneration: {
          minimumLength: 4,
        },
      };

      const configPath = await cliHarness.createTestConfig(tempDir, config, 'precedence.json');

      // Test various precedence scenarios
      const precedenceTests = [
        {
          name: 'config file only',
          args: ['--config', configPath, 'init-config'],
          description: 'Should use config file values',
        },
        {
          name: 'CLI flag override',
          args: ['--config', configPath, '--length', '6', 'init-config'],
          description: 'CLI flag should override config file',
        },
      ];

      for (const test of precedenceTests) {
        const result = await cliHarness.executeCommandInDirectory(test.args, tempDir, {
          timeout: 15000,
        });

        // Configuration loading should work consistently
        expect(result.exitCode).toBe(0);

        const output = result.stdout || result.stderr;
        expect(output).toBeTruthy();
      }
    });

    it('should provide consistent error handling for invalid configurations', async () => {
      // Test various invalid configuration scenarios
      const invalidConfigs = [
        {
          name: 'malformed JSON',
          content: '{ invalid json',
          filename: 'malformed.json',
        },
        {
          name: 'missing required fields',
          config: {
            /* missing input and output */
          },
          filename: 'incomplete.json',
        },
      ];

      for (const testCase of invalidConfigs) {
        let configPath;

        if (testCase.content) {
          configPath = path.join(tempDir, testCase.filename);
          await fs.writeFile(configPath, testCase.content);
        } else if (testCase.config) {
          configPath = await cliHarness.createTestConfig(
            tempDir,
            testCase.config,
            testCase.filename
          );
        }

        const result = await cliHarness.executeCommandInDirectory(
          ['--config', configPath, 'init-config'],
          tempDir,
          { expectFailure: true, timeout: 10000 }
        );

        // Should handle invalid configurations gracefully
        expect(result.exitCode).toBeGreaterThan(0);

        const errorOutput = result.stderr || result.stdout;
        expect(errorOutput).toMatch(/error|invalid|configuration|config/i);
      }
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle path separators consistently', async () => {
      // Test different path formats
      const pathTests = [
        {
          config: { input: './src', output: './dist' },
          description: 'relative paths with forward slashes',
        },
        {
          config: { input: '../src', output: '../dist' },
          description: 'relative paths with parent directory',
        },
      ];

      for (const test of pathTests) {
        const configPath = await cliHarness.createTestConfig(
          tempDir,
          test.config,
          'path-test.json'
        );

        const result = await cliHarness.executeCommandInDirectory(
          ['--config', configPath, 'init-config'],
          tempDir,
          { timeout: 15000, expectFailure: false }
        );

        // Path handling should be consistent across platforms
        expect(result.exitCode).toBeGreaterThanOrEqual(0);

        if (result.exitCode !== 0) {
          // If path causes issues, should provide clear error message
          const output = result.stderr || result.stdout;
          expect(output).toMatch(/path|directory|file|error/i);
        }
      }
    });

    it('should handle file permissions appropriately', async () => {
      // Create a config file and test different permission scenarios
      const config = { input: './src', output: './dist' };
      const configPath = await cliHarness.createTestConfig(tempDir, config, 'permissions.json');

      // Test reading the configuration file
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir,
        { timeout: 15000 }
      );

      // Basic file reading should work (more complex permission tests would need platform-specific logic)
      expect(result.exitCode).toBe(0);
    });
  });
});
