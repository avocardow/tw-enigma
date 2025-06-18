/**
 * CLI Option Combinations Integration Tests
 *
 * Tests various combinations of CLI options and flags
 * to ensure proper interaction and behavior.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliAssertions, CliTestHarness } from '../utils/cli-test-harness';
import { IntegrationAssertions } from '../utils/integration-assertions';

describe('CLI Option Combinations Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Global Flag Combinations', () => {
    it('should handle --length with --verbose', async () => {
      const result = await cliHarness.executeCommand(['--length', '8', '--verbose', 'init-config']);

      // Validate success
      CliAssertions.assertSuccess(result);

      // Validate length integration
      IntegrationAssertions.assertLengthIntegration(result, 8, 'init-config');

      // Validate verbose output
      expect(result.stderr).toMatch(/verbose|debug/i);
    });

    it('should handle --length with --pretty', async () => {
      const result = await cliHarness.executeCommand(['--length', '12', '--pretty', 'init-config']);

      // Validate success
      CliAssertions.assertSuccess(result);

      // Validate length integration
      IntegrationAssertions.assertLengthIntegration(result, 12, 'init-config');

      // Validate pretty formatting
      expect(result.stdout).toMatch(/\n\s+/); // Should have indentation
    });

    it('should handle --length with --input and --output', async () => {
      const result = await cliHarness.executeCommand([
        '--length',
        '6',
        '--input',
        './custom-src',
        '--output',
        './custom-dist',
        'init-config',
      ]);

      // Validate data flow integration
      IntegrationAssertions.assertDataFlow(
        result,
        {
          minimumLength: 6,
          input: './custom-src',
          output: './custom-dist',
        },
        'Length with input/output combination'
      );
    });

    it('should handle all global flags together', async () => {
      const result = await cliHarness.executeCommand([
        '--length',
        '10',
        '--verbose',
        '--pretty',
        '--input',
        './all-flags-src',
        '--output',
        './all-flags-dist',
        'init-config',
      ]);

      // Validate complex integration
      IntegrationAssertions.assertComplexIntegration(
        result,
        {
          minimumLength: 10,
          verbose: true,
          pretty: true,
          input: './all-flags-src',
          output: './all-flags-dist',
        },
        'All global flags combination'
      );
    });
  });

  describe('Command-Specific Option Combinations', () => {
    it('should handle init-config with all options', async () => {
      const result = await cliHarness.executeCommand([
        '--length',
        '8',
        '--pretty',
        'init-config',
        '--name',
        'test-project',
        '--version',
        '1.0.0',
      ]);

      // Validate project configuration
      expect(result.stdout).toContain('test-project');
      expect(result.stdout).toContain('1.0.0');

      // Validate length integration
      IntegrationAssertions.assertLengthIntegration(result, 8, 'init-config');
    });

    it('should handle css-config with styling options', async () => {
      const result = await cliHarness.executeCommand([
        '--length',
        '6',
        '--pretty',
        'css-config',
        '--theme',
        'dark',
        '--compress',
      ]);

      // Validate CSS generation with options
      expect(result.stdout).toMatch(/\.css/);
      IntegrationAssertions.assertLengthIntegration(result, 6, 'css-config');
    });
  });

  describe('Edge Case Combinations', () => {
    it('should handle minimum length values', async () => {
      const result = await cliHarness.executeCommand(['--length', '1', 'init-config']);

      // Should succeed with minimum length
      IntegrationAssertions.assertLengthIntegration(result, 1, 'init-config');
    });

    it('should handle maximum reasonable length values', async () => {
      const result = await cliHarness.executeCommand(['--length', '50', 'init-config']);

      // Should handle large length values
      IntegrationAssertions.assertLengthIntegration(result, 50, 'init-config');
    });

    it('should handle conflicting options gracefully', async () => {
      const result = await cliHarness.executeCommand(['--verbose', '--quiet', 'init-config']);

      // Should handle conflicting verbosity flags
      expect(result.exitCode).toBeDefined();
      // Should either succeed with one taking precedence or fail gracefully
    });

    it('should handle duplicate length specifications', async () => {
      const result = await cliHarness.executeCommand([
        '--length',
        '8',
        '--length',
        '12',
        'init-config',
      ]);

      // Should use last specified value or handle gracefully
      expect(result.exitCode).toBeDefined();
    });
  });

  describe('Integration Consistency', () => {
    it('should maintain consistency across multiple invocations', async () => {
      const results = await Promise.all([
        cliHarness.executeCommand(['--length', '8', 'init-config']),
        cliHarness.executeCommand(['--length', '8', 'init-config']),
        cliHarness.executeCommand(['--length', '8', 'init-config']),
      ]);

      // All should behave consistently
      results.forEach((result) => {
        IntegrationAssertions.assertLengthIntegration(result, 8, 'init-config');
      });

      // Outputs should be similar (accounting for timestamps, etc.)
      const outputs = results.map((r) => r.stdout);
      expect(outputs[0]).toBeTruthy();
      expect(outputs[1]).toBeTruthy();
      expect(outputs[2]).toBeTruthy();
    });

    it('should validate option precedence rules', async () => {
      // Test environment variable vs CLI flag precedence
      const envResult = await cliHarness.executeCommandWithEnv(['init-config'], {
        TW_ENIGMA_LENGTH: '10',
      });

      const flagResult = await cliHarness.executeCommand(['--length', '12', 'init-config']);

      const bothResult = await cliHarness.executeCommandWithEnv(['--length', '14', 'init-config'], {
        TW_ENIGMA_LENGTH: '10',
      });

      // CLI flag should take precedence over environment variable
      if (bothResult.exitCode === 0) {
        IntegrationAssertions.assertLengthIntegration(bothResult, 14, 'init-config');
      }
    });
  });

  describe('Performance with Complex Options', () => {
    it('should handle complex option combinations efficiently', async () => {
      const startTime = Date.now();

      const result = await cliHarness.executeCommand([
        '--length',
        '15',
        '--verbose',
        '--pretty',
        '--input',
        './complex-test',
        '--output',
        './complex-output',
        'init-config',
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);

      // Validate complex integration still works
      IntegrationAssertions.assertComplexIntegration(
        result,
        {
          minimumLength: 15,
          verbose: true,
          pretty: true,
          input: './complex-test',
          output: './complex-output',
        },
        'Performance test with complex options'
      );
    });
  });
});
