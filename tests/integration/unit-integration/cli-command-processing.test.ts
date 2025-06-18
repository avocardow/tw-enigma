/**
 * CLI Command Processing Integration Test
 *
 * Tests the internal integration points within the CLI package:
 * - Command parsing and validation
 * - Option processing and validation
 * - Global option integration (--length)
 * - Command execution flow
 * - Output formatting and error handling
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliAssertions, cliHarness } from '../utils/cli-test-harness';
import { IntegrationAssertions, IntegrationTestData } from '../utils/integration-assertions';

describe('CLI Command Processing Integration', () => {
  beforeEach(async () => {
    // Ensure CLI is available before each test
    await cliHarness.waitForCliAvailability(10000);
  });

  afterEach(async () => {
    // Clean up any temporary files created during tests
    // Cleanup is handled automatically by the test harness
  });

  describe('Basic Command Processing', () => {
    it('should process help command correctly', async () => {
      const result = await cliHarness.executeHelp();

      CliAssertions.assertSuccess(result);
      CliAssertions.assertOutputContains(result, 'Usage:', 'stdout');
      CliAssertions.assertOutputContains(result, 'Commands:', 'stdout');
      CliAssertions.assertOutputContains(result, 'css-config', 'stdout');
      CliAssertions.assertOutputContains(result, 'init-config', 'stdout');

      // Verify execution time is reasonable
      CliAssertions.assertExecutionTime(
        result,
        IntegrationTestData.performanceThresholds.cliCommandExecution
      );
    });

    it('should process version command correctly', async () => {
      const result = await cliHarness.executeVersion();

      CliAssertions.assertSuccess(result);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/); // Should contain version number

      // Version command should be very fast
      CliAssertions.assertExecutionTime(result, 1000);
    });

    it('should handle invalid commands gracefully', async () => {
      const result = await cliHarness.executeCommand('invalid-command', [], {
        expectFailure: true,
      });

      CliAssertions.assertFailure(result);
      expect(result.stderr).toMatch(/unknown.*command|invalid.*command/i);

      // Should suggest available commands
      expect(result.stderr).toMatch(/available.*commands|try.*help/i);
    });
  });

  describe('Global Option Processing', () => {
    it('should process --length option with css-config command', async () => {
      const result = await cliHarness.executeCssConfigWithLength(8);

      CliAssertions.assertSuccess(result);
      IntegrationAssertions.assertLengthIntegration(result, 8, 'css-config');

      // Should contain CSS-specific output
      expect(result.stdout).toMatch(/\.css|@apply|@tailwind/);
    });

    it('should process --length option with init-config command', async () => {
      const result = await cliHarness.executeInitConfigWithLength(5);

      CliAssertions.assertSuccess(result);
      IntegrationAssertions.assertLengthIntegration(result, 5, 'init-config');

      // Should contain configuration output
      expect(result.stdout).toContain('module.exports');
      expect(result.stdout).toContain('nameGeneration');
    });

    it('should validate --length option values', async () => {
      // Test invalid length values
      const invalidValues = [-1, 0, 'abc', ''];

      for (const invalidValue of invalidValues) {
        const result = await cliHarness.executeCommand(
          `--length=${invalidValue}`,
          ['init-config'],
          { expectFailure: true }
        );

        CliAssertions.assertFailure(result);
        IntegrationAssertions.assertErrorPropagation(result, 'validation');
      }
    });

    it('should handle missing --length value gracefully', async () => {
      const result = await cliHarness.executeCommand('--length', ['init-config'], {
        expectFailure: true,
      });

      CliAssertions.assertFailure(result);
      expect(result.stderr).toMatch(/length.*requires.*value|missing.*value/i);
    });
  });

  describe('Command Execution Flow', () => {
    it('should execute css-config command with proper flow', async () => {
      const result = await cliHarness.executeCssConfig();

      CliAssertions.assertSuccess(result);

      // Verify expected processing steps
      IntegrationAssertions.assertCommandIntegration(result, ['processing', 'generating', 'css'], {
        output: 'css',
        configuration: 'generated',
      });
    });

    it('should execute init-config command with proper flow', async () => {
      const result = await cliHarness.executeInitConfig();

      CliAssertions.assertSuccess(result);

      // Verify expected processing steps
      IntegrationAssertions.assertCommandIntegration(result, ['generating', 'configuration'], {
        pretty: false,
        minify: true,
        removeUnused: true,
      });
    });

    it('should maintain consistent output format across commands', async () => {
      const cssResult = await cliHarness.executeCssConfig();
      const initResult = await cliHarness.executeInitConfig();

      CliAssertions.assertSuccess(cssResult);
      CliAssertions.assertSuccess(initResult);

      // Both should have consistent output structure
      expect(cssResult.stdout).toBeDefined();
      expect(initResult.stdout).toBeDefined();

      // Both should provide user feedback
      expect(cssResult.stderr || cssResult.stdout).toMatch(/generated|created|output/i);
      expect(initResult.stderr || initResult.stdout).toMatch(/generated|created|output/i);
    });
  });

  describe('Option Validation Integration', () => {
    it('should validate command-specific options', async () => {
      // Test css-config with invalid options
      const cssResult = await cliHarness.executeCommand('css-config', ['--invalid-option'], {
        expectFailure: true,
      });

      CliAssertions.assertFailure(cssResult);
      expect(cssResult.stderr).toMatch(/unknown.*option|invalid.*option/i);
    });

    it('should handle conflicting options gracefully', async () => {
      // Test with conflicting length values (should use the last one)
      const result = await cliHarness.executeCommand('--length=5', ['--length=8', 'init-config']);

      CliAssertions.assertSuccess(result);

      // Should use the last specified value
      expect(result.stdout).toMatch(/minimumLength.*8/);
      expect(result.stderr).toMatch(/minimum.*length.*8/i);
    });

    it('should preserve option order and precedence', async () => {
      const result = await cliHarness.executeCommand('init-config', ['--length=12']);

      CliAssertions.assertSuccess(result);
      IntegrationAssertions.assertLengthIntegration(result, 12, 'init-config');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle command parsing errors', async () => {
      const result = await cliHarness.executeCommand('', [], { expectFailure: true });

      CliAssertions.assertFailure(result);
      expect(result.stderr).toMatch(/no.*command|missing.*command/i);
    });

    it('should provide helpful error messages', async () => {
      const result = await cliHarness.executeCommand('xyz', [], { expectFailure: true });

      CliAssertions.assertFailure(result);
      IntegrationAssertions.assertErrorPropagation(result, 'validation', false);

      // Should suggest corrections
      expect(result.stderr).toMatch(/did.*you.*mean|available.*commands|try.*help/i);
    });

    it('should handle system errors gracefully', async () => {
      // Test with insufficient permissions (simulated)
      const tempDir = await cliHarness.createTempWorkDir();

      const result = await cliHarness.executeInitConfig([], {
        cwd: '/root', // This should fail with permission error
        expectFailure: true,
      });

      // Should handle gracefully even if it fails
      expect(result.exitCode).toBeGreaterThan(0);
    });
  });

  describe('Performance Integration', () => {
    it('should execute commands within performance thresholds', async () => {
      const commands = [
        () => cliHarness.executeHelp(),
        () => cliHarness.executeVersion(),
        () => cliHarness.executeCssConfig(),
        () => cliHarness.executeInitConfig(),
      ];

      for (const command of commands) {
        const result = await command();
        CliAssertions.assertSuccess(result);
        CliAssertions.assertExecutionTime(
          result,
          IntegrationTestData.performanceThresholds.cliCommandExecution
        );
      }
    });

    it('should handle concurrent command execution', async () => {
      // Run multiple commands concurrently
      const promises = [
        cliHarness.executeVersion(),
        cliHarness.executeHelp(),
        cliHarness.executeInitConfigWithLength(3),
        cliHarness.executeCssConfigWithLength(5),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        CliAssertions.assertSuccess(result);
      });

      // Verify specific outputs
      expect(results[0].stdout).toMatch(/\d+\.\d+\.\d+/); // Version
      expect(results[1].stdout).toContain('Usage:'); // Help
      expect(results[2].stdout).toMatch(/minimumLength.*3/); // Init with length 3
      expect(results[3].stdout).toMatch(/\.css/); // CSS config
    });
  });
});
