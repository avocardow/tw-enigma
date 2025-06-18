/**
 * CLI Global Flag Processing Integration Test
 *
 * Tests the integration of global flags within the CLI package:
 * - Global --length flag processing
 * - Flag precedence and validation
 * - Integration with all commands
 * - Environment variable integration
 * - Configuration override behavior
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CliAssertions, cliHarness } from '../utils/cli-test-harness';
import { IntegrationAssertions, IntegrationTestData } from '../utils/integration-assertions';

describe('CLI Global Flag Processing Integration', () => {
  beforeEach(async () => {
    await cliHarness.waitForCliAvailability(10000);
  });

  describe('Length Flag Core Processing', () => {
    it('should parse --length flag correctly', async () => {
      const testValues = [1, 5, 10, 25, 50];

      for (const length of testValues) {
        const result = await cliHarness.executeInitConfigWithLength(length);

        CliAssertions.assertSuccess(result);
        IntegrationAssertions.assertLengthIntegration(result, length, 'init-config');

        // Verify the value is processed correctly
        expect(result.stdout).toMatch(new RegExp(`minimumLength.*${length}`));
        expect(result.stderr).toMatch(new RegExp(`minimum.*length.*${length}`, 'i'));
      }
    });

    it('should validate --length flag boundaries', async () => {
      const validValues = [1, 2, 3, 50, 100];
      const invalidValues = [-1, 0, 'abc', ''];

      // Test valid values
      for (const length of validValues) {
        const result = await cliHarness.executeInitConfigWithLength(length);
        CliAssertions.assertSuccess(result);
        expect(result.stdout).toMatch(new RegExp(`minimumLength.*${length}`));
      }

      // Test invalid values
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
  });

  describe('Command Integration with Length Flag', () => {
    it('should integrate --length with init-config command', async () => {
      const result = await cliHarness.executeInitConfigWithLength(12);

      CliAssertions.assertSuccess(result);
      IntegrationAssertions.assertLengthIntegration(result, 12, 'init-config');

      // Should generate configuration with nameGeneration
      expect(result.stdout).toContain('nameGeneration');
      expect(result.stdout).toMatch(/minimumLength.*12/);
      expect(result.stdout).toMatch(/strategy.*sequential/);
    });

    it('should handle --length with help command', async () => {
      const result = await cliHarness.executeCommand('--length=5', ['--help']);

      CliAssertions.assertSuccess(result);
      expect(result.stdout).toContain('Usage:');

      // Length flag should not affect help output
      expect(result.stdout).toContain('--length');
    });
  });

  describe('Flag Precedence and Order', () => {
    it('should handle multiple --length flags (last wins)', async () => {
      const result = await cliHarness.executeCommand('--length=5', [
        '--length=8',
        '--length=12',
        'init-config',
      ]);

      CliAssertions.assertSuccess(result);

      // Should use the last specified value
      expect(result.stdout).toMatch(/minimumLength.*12/);
      expect(result.stderr).toMatch(/minimum.*length.*12/i);
    });

    it('should maintain flag precedence over environment variables', async () => {
      const result = await cliHarness.executeInitConfigWithLength(15, [], {
        env: {
          ENIGMA_LENGTH: '8', // Environment variable should be overridden
        },
      });

      CliAssertions.assertSuccess(result);

      // CLI flag should take precedence
      expect(result.stdout).toMatch(/minimumLength.*15/);
      IntegrationAssertions.assertConfigPriority(result, 'cli', 15);
    });
  });

  describe('Environment Variable Integration', () => {
    it('should use environment variables when no CLI flag provided', async () => {
      const result = await cliHarness.executeInitConfig([], {
        env: {
          ENIGMA_LENGTH: '9',
        },
      });

      CliAssertions.assertSuccess(result);

      // Should use environment variable value
      expect(result.stdout).toMatch(/minimumLength.*9/);
      IntegrationAssertions.assertConfigPriority(result, 'env', 9);
    });

    it('should handle missing environment variables gracefully', async () => {
      const result = await cliHarness.executeInitConfig([], {
        env: {
          // No ENIGMA_LENGTH set
        },
      });

      CliAssertions.assertSuccess(result);

      // Should use default behavior (no nameGeneration)
      expect(result.stdout).not.toMatch(/[^/]nameGeneration.*{/);
      expect(result.stdout).toContain('// nameGeneration:');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed --length flags', async () => {
      const malformedFlags = ['--length=', '--length=abc', '--length=1.5', '--length=-0'];

      for (const flag of malformedFlags) {
        const result = await cliHarness.executeCommand(flag, ['init-config'], {
          expectFailure: true,
        });

        CliAssertions.assertFailure(result);
        expect(result.stderr).toMatch(/invalid.*length|invalid.*value/i);
      }
    });

    it('should provide helpful error messages for invalid length', async () => {
      const result = await cliHarness.executeCommand('--length=abc', ['init-config'], {
        expectFailure: true,
      });

      CliAssertions.assertFailure(result);
      IntegrationAssertions.assertErrorPropagation(result, 'validation', false);

      // Should suggest valid values
      expect(result.stderr).toMatch(/must.*be.*number|valid.*range|positive.*integer/i);
    });
  });

  describe('Performance and Scalability', () => {
    it('should process flags efficiently', async () => {
      const result = await cliHarness.executeInitConfigWithLength(7);

      CliAssertions.assertSuccess(result);
      CliAssertions.assertExecutionTime(
        result,
        IntegrationTestData.performanceThresholds.cliCommandExecution
      );
    });

    it('should handle multiple flag processing efficiently', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        cliHarness.executeInitConfigWithLength(i + 1)
      );

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        CliAssertions.assertSuccess(result);
        expect(result.stdout).toMatch(new RegExp(`minimumLength.*${index + 1}`));
      });
    });
  });
});
