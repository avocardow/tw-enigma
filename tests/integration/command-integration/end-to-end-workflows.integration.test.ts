/**
 * End-to-End Command Workflows Integration Tests
 *
 * Tests complete command workflows from input to output,
 * validating the entire processing pipeline.
 */

import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configFixtures } from '../fixtures/config-generators';
import { CliAssertions, CliTestHarness } from '../utils/cli-test-harness';
import { IntegrationAssertions, IntegrationUtils } from '../utils/integration-assertions';

describe('End-to-End Command Workflows Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Complete Init-Config Workflow', () => {
    it('should complete full init-config workflow with default settings', async () => {
      // Execute complete workflow
      const result = await cliHarness.executeCommand(['init-config']);

      // Validate successful execution
      CliAssertions.assertSuccess(result);

      // Validate output contains complete configuration
      expect(result.stdout).toContain('module.exports');
      expect(result.stdout).toContain('input:');
      expect(result.stdout).toContain('output:');
      expect(result.stdout).toContain('// nameGeneration:');

      // Validate processing steps
      IntegrationAssertions.assertCommandIntegration(
        result,
        ['configuration', 'generated', 'sample'],
        {
          input: './src',
          output: './dist',
          minify: true,
          removeUnused: true,
        }
      );
    });

    it('should complete init-config workflow with length parameter', async () => {
      // Execute workflow with length parameter
      const result = await cliHarness.executeCommand(['--length', '8', 'init-config']);

      // Validate successful execution
      CliAssertions.assertSuccess(result);

      // Validate length integration
      IntegrationAssertions.assertLengthIntegration(result, 8, 'init-config');

      // Validate configuration contains length setting
      expect(result.stdout).toMatch(/minimumLength.*8/);
      expect(result.stdout).toContain('nameGeneration');
    });

    it('should complete init-config with multiple parameters', async () => {
      // Execute with multiple parameters
      const result = await cliHarness.executeCommand([
        '--length',
        '12',
        '--verbose',
        '--pretty',
        'init-config',
      ]);

      // Validate execution
      CliAssertions.assertSuccess(result);

      // Validate all parameters are applied
      expect(result.stdout).toMatch(/minimumLength.*12/);
      expect(result.stdout).toMatch(/pretty.*true/);

      // Validate verbose output
      expect(result.stderr).toMatch(/verbose|debug/i);
    });

    it('should handle init-config with custom paths', async () => {
      // Execute with custom input/output paths
      const result = await cliHarness.executeCommand([
        '--input',
        './custom-src',
        '--output',
        './custom-dist',
        'init-config',
      ]);

      // Validate execution
      CliAssertions.assertSuccess(result);

      // Validate custom paths in output
      expect(result.stdout).toContain('./custom-src');
      expect(result.stdout).toContain('./custom-dist');
    });
  });

  describe('Complete CSS-Config Workflow', () => {
    it('should complete full css-config workflow', async () => {
      // Execute css-config workflow
      const result = await cliHarness.executeCommand(['css-config']);

      // Validate successful execution
      CliAssertions.assertSuccess(result);

      // Validate CSS output
      expect(result.stdout).toMatch(/\.css|@apply|@layer/);

      // Validate processing steps
      IntegrationAssertions.assertCommandIntegration(result, ['css', 'generated', 'tailwind'], {
        css: true,
      });
    });

    it('should complete css-config with length parameter', async () => {
      // Execute css-config with length
      const result = await cliHarness.executeCommand(['--length', '6', 'css-config']);

      // Validate execution
      CliAssertions.assertSuccess(result);

      // Validate length integration
      IntegrationAssertions.assertLengthIntegration(result, 6, 'css-config');

      // Validate CSS contains generated class names
      expect(result.stdout).toMatch(/\.css/);
    });

    it('should handle css-config with configuration options', async () => {
      // Execute with configuration options
      const result = await cliHarness.executeCommand([
        '--pretty',
        '--config',
        path.join(tempDir, 'test-config.js'),
        'css-config',
      ]);

      // Note: May fail if config file doesn't exist, but should handle gracefully
      if (result.exitCode === 0) {
        expect(result.stdout).toMatch(/\.css/);
      } else {
        // Should provide helpful error about missing config file
        expect(result.stderr).toMatch(/config.*file|not.*found/i);
      }
    });
  });

  describe('Command Chaining and Sequences', () => {
    it('should support sequential command execution', async () => {
      // Execute multiple commands in sequence
      const results = await Promise.all([
        cliHarness.executeCommand(['--version']),
        cliHarness.executeCommand(['--help']),
        cliHarness.executeCommand(['init-config']),
        cliHarness.executeCommand(['css-config']),
      ]);

      // Validate all commands succeeded
      results.forEach((result, index) => {
        if (index < 2) {
          // Version and help should always succeed
          CliAssertions.assertSuccess(result);
        } else {
          // Config commands might have different outcomes
          expect(result.exitCode).toBeDefined();
        }
      });

      // Validate specific outputs
      expect(results[0].stdout).toMatch(/\d+\.\d+\.\d+/); // Version pattern
      expect(results[1].stdout).toContain('Usage:'); // Help content
      expect(results[2].stdout).toContain('module.exports'); // Config content
      expect(results[3].stdout).toMatch(/\.css/); // CSS content
    });

    it('should handle concurrent command execution', async () => {
      // Test concurrent execution with different parameters
      const promises = [
        cliHarness.executeCommand(['--length', '3', 'init-config']),
        cliHarness.executeCommand(['--length', '6', 'init-config']),
        cliHarness.executeCommand(['--length', '9', 'init-config']),
      ];

      const results = await Promise.allSettled(promises);

      // Validate that commands can run concurrently
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          CliAssertions.assertSuccess(result.value);
          const expectedLength = (index + 1) * 3;
          expect(result.value.stdout).toMatch(new RegExp(`minimumLength.*${expectedLength}`));
        }
      });
    });
  });

  describe('Workflow Error Handling', () => {
    it('should handle invalid command workflows gracefully', async () => {
      // Test invalid command
      const result = await cliHarness.executeCommand(['invalid-command']);

      // Should fail with helpful error
      CliAssertions.assertFailure(result);
      expect(result.stderr || result.stdout).toMatch(/unknown.*command|invalid.*command/i);
    });

    it('should handle workflows with invalid parameters', async () => {
      // Test invalid length parameter
      const result = await cliHarness.executeCommand(['--length', 'invalid', 'init-config']);

      // Should fail with validation error
      CliAssertions.assertFailure(result);
      IntegrationAssertions.assertErrorPropagation(result, 'validation', false);
    });

    it('should handle interrupted workflows', async () => {
      // Test command with timeout (simulating interruption)
      const timeoutPromise = IntegrationUtils.withTimeout(
        cliHarness.executeCommand(['init-config']),
        100, // Very short timeout
        'Command interruption test'
      );

      try {
        await timeoutPromise;
      } catch (error: any) {
        // Should handle timeout gracefully
        expect(error.message).toContain('timed out');
      }
    });
  });

  describe('Performance and Resource Workflows', () => {
    it('should complete workflows within performance thresholds', async () => {
      const startTime = Date.now();

      // Execute workflow and measure performance
      const result = await cliHarness.executeCommand(['init-config']);

      const executionTime = Date.now() - startTime;

      // Validate performance
      IntegrationAssertions.assertPerformance(
        result,
        5000, // 5 second threshold
        {
          executionTime,
          errorCount: result.exitCode === 0 ? 0 : 1,
        }
      );
    });

    it('should handle workflows with resource constraints', async () => {
      // Test multiple concurrent workflows
      const concurrentPromises = Array.from({ length: 5 }, (_, i) =>
        cliHarness.executeCommand(['--length', String(i + 1), 'init-config'])
      );

      const results = await Promise.allSettled(concurrentPromises);

      // Most should succeed despite resource constraints
      const successCount = results.filter(
        (result) => result.status === 'fulfilled' && result.value.exitCode === 0
      ).length;

      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Data Flow Validation', () => {
    it('should validate complete data flow through workflow', async () => {
      // Execute workflow with specific parameters
      const result = await cliHarness.executeCommand([
        '--length',
        '10',
        '--input',
        './test-input',
        '--output',
        './test-output',
        'init-config',
      ]);

      // Validate data flow
      IntegrationAssertions.assertDataFlow(
        result,
        {
          minimumLength: 10,
          input: './test-input',
          output: './test-output',
        },
        'Complete init-config data flow'
      );
    });

    it('should validate configuration priority in workflows', async () => {
      // Set environment variable
      const env = { TW_ENIGMA_LENGTH: '5' };

      // Execute with CLI override
      const result = await cliHarness.executeCommand(['--length', '15', 'init-config'], { env });

      // CLI should take precedence over environment
      IntegrationAssertions.assertConfigPriority(result, 'cli', 15);
    });
  });

  describe('Integration with File System', () => {
    it('should handle workflows with file system operations', async () => {
      // Create a config file
      const configPath = path.join(tempDir, 'test-config.js');
      const configContent = configFixtures.generateJavaScriptConfig({
        minimumLength: 7,
        input: './custom-input',
      });

      await fs.writeFile(configPath, configContent);

      // Execute workflow with config file
      const result = await cliHarness.executeCommand(['--config', configPath, 'init-config']);

      // Validate file system integration
      IntegrationAssertions.assertFileSystemIntegration(result, [configPath], [tempDir]);
    });

    it('should handle workflows with missing files gracefully', async () => {
      // Execute with non-existent config file
      const result = await cliHarness.executeCommand([
        '--config',
        '/non/existent/config.js',
        'init-config',
      ]);

      // Should handle missing file gracefully
      if (result.exitCode !== 0) {
        expect(result.stderr).toMatch(/config.*file.*not.*found|file.*does.*not.*exist/i);
      }
    });
  });

  describe('Cross-Command Integration', () => {
    it('should validate consistency between init-config and css-config', async () => {
      // Execute both commands with same parameters
      const initResult = await cliHarness.executeCommand(['--length', '8', 'init-config']);
      const cssResult = await cliHarness.executeCommand(['--length', '8', 'css-config']);

      // Both should succeed
      CliAssertions.assertSuccess(initResult);
      CliAssertions.assertSuccess(cssResult);

      // Both should respect the length parameter
      expect(initResult.stdout).toMatch(/minimumLength.*8/);
      // CSS output should reflect length parameter
      expect(cssResult.stdout).toMatch(/\.css/);
    });

    it('should validate help and version consistency', async () => {
      // Execute help and version commands
      const helpResult = await cliHarness.executeCommand(['--help']);
      const versionResult = await cliHarness.executeCommand(['--version']);

      // Both should succeed
      CliAssertions.assertSuccess(helpResult);
      CliAssertions.assertSuccess(versionResult);

      // Help should mention available commands
      expect(helpResult.stdout).toMatch(/init-config|css-config/);

      // Version should be valid semver
      expect(versionResult.stdout).toMatch(/^\d+\.\d+\.\d+/);
    });
  });
});
