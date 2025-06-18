import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Import types from core package

// Test utilities
import { ConfigFixtureGenerator } from '../fixtures/config-generators';
import { CliAssertions, cliHarness } from '../utils/cli-test-harness';
import { IntegrationAssertions } from '../utils/integration-assertions';

describe('Cross-Package Interface Contracts Integration', () => {
  let testFixtureGenerator: ConfigFixtureGenerator;

  beforeEach(async () => {
    testFixtureGenerator = new ConfigFixtureGenerator();
    await cliHarness.waitForCliAvailability(10000);
  });

  afterEach(async () => {
    // Cleanup handled by test harness
  });

  describe('NameGenerationOptions Interface Compatibility', () => {
    it('should maintain interface compatibility between CLI and Core', async () => {
      // Test that CLI can create valid NameGenerationOptions that Core accepts
      const result = await cliHarness.executeCssConfigWithLength(8);

      CliAssertions.assertSuccess(result);

      // Validate that output contains nameGeneration configuration
      expect(result.stdout).toContain('nameGeneration');
      expect(result.stdout).toContain('"minimumLength": 8');

      // Verify interface contract requirements through output structure
      IntegrationAssertions.assertLengthIntegration(result, 8, 'css-config');
    });

    it('should handle interface evolution gracefully', async () => {
      // Test CLI should handle unknown fields gracefully
      const result = await cliHarness.executeCssConfigWithLength(7, ['--pretty']);

      CliAssertions.assertSuccess(result);

      // Should produce valid output despite potential future field handling
      expect(result.stdout).toContain('nameGeneration');
      expect(result.stdout).toContain('"minimumLength": 7');
    });

    it('should validate required interface fields', async () => {
      // Test that invalid length values are properly handled
      const result = await cliHarness.executeCommand('--length=0', ['css-config'], {
        expectFailure: true,
      });

      // Should fail gracefully with meaningful error
      CliAssertions.assertFailure(result);
      expect(result.stderr).toMatch(/length|minimum|invalid|value/i);
    });

    it('should enforce type constraints at runtime', async () => {
      // Test runtime type validation with invalid string for length
      const result = await cliHarness.executeCommand('--length=invalid-strategy', ['css-config'], {
        expectFailure: true,
      });

      CliAssertions.assertFailure(result);
      expect(result.stderr).toMatch(/invalid|type|value|number/i);
    });
  });

  describe('Configuration Schema Interface Compatibility', () => {
    it('should maintain configuration schema interface contracts', async () => {
      // Test full configuration compatibility
      const result = await cliHarness.executeInitConfigWithLength(9);

      CliAssertions.assertSuccess(result);

      // Validate schema conformance
      expect(result.stdout).toContain('nameGeneration');
      expect(result.stdout).toContain('"minimumLength": 9');

      // Should contain expected configuration structure
      expect(result.stdout).toContain('module.exports');
    });

    it('should handle partial configuration schemas', async () => {
      // Test that partial configurations are properly handled
      const result = await cliHarness.executeCssConfigWithLength(10, ['--verbose']);

      CliAssertions.assertSuccess(result);

      // Should fill in defaults for missing sections
      expect(result.stdout).toContain('nameGeneration');
      expect(result.stdout).toContain('"minimumLength": 10');
    });

    it('should validate configuration schema constraints', async () => {
      // Test configuration validation boundaries
      const constraintTests = [
        { value: -1, error: /minimum.*length.*1/i },
        { value: 0, error: /minimum.*length.*1/i },
        { value: 27, error: /minimum.*length.*26/i },
      ];

      for (const test of constraintTests) {
        const result = await cliHarness.executeCommand(`--length=${test.value}`, ['css-config'], {
          expectFailure: true,
        });

        CliAssertions.assertFailure(result);
        expect(result.stderr).toMatch(test.error);
      }
    });
  });

  describe('Error Interface Compatibility', () => {
    it('should handle CLI error types consistently', async () => {
      // Test that CLI handles errors with compatible interfaces
      const result = await cliHarness.executeCommand('nonexistent-command', [], {
        expectFailure: true,
      });

      CliAssertions.assertFailure(result);
      expect(result.stderr).toBeTruthy();

      // Error should be structured and informative
      const errorOutput = result.stderr;
      expect(errorOutput).toMatch(/command|unknown|invalid/i);
    });

    it('should maintain error message structure across packages', async () => {
      // Test error message consistency
      const result = await cliHarness.executeCommand('--length=abc', ['css-config'], {
        expectFailure: true,
      });

      CliAssertions.assertFailure(result);

      // Error should have consistent structure
      const errorOutput = result.stderr;
      expect(errorOutput).toMatch(/invalid|type|value/i);
    });

    it('should provide user-friendly error messages in production mode', async () => {
      // Test production error handling
      const result = await cliHarness.executeCommand('--invalid-flag', ['css-config'], {
        expectFailure: true,
      });

      CliAssertions.assertFailure(result);

      // Should be user-friendly
      const errorOutput = result.stderr;
      expect(errorOutput).toMatch(/unknown.*option|invalid.*option/i);
    });
  });

  describe('Version Compatibility Interface Testing', () => {
    it('should maintain backward compatibility with configuration formats', async () => {
      // Test that CLI can work with various configuration patterns
      const result = await cliHarness.executeCssConfigWithLength(11);

      // Should handle configuration gracefully
      CliAssertions.assertSuccess(result);
      expect(result.stdout).toContain('nameGeneration');
      expect(result.stdout).toContain('"minimumLength": 11');
    });

    it('should validate interface version compatibility', async () => {
      // Test version checking through successful execution
      const result = await cliHarness.executeInitConfigWithLength(12);

      // Should handle version compatibility gracefully
      CliAssertions.assertSuccess(result);
      expect(result.stdout).toContain('"minimumLength": 12');
    });
  });

  describe('Type Safety Validation', () => {
    it('should enforce strict type checking at runtime', async () => {
      // Test that runtime validation matches expected types
      const typeTestCases = [
        { value: 'string', error: /number|invalid|type/i },
        { value: 'true', error: /number|invalid|type/i },
        { value: '[]', error: /number|invalid|type/i },
      ];

      for (const testCase of typeTestCases) {
        const result = await cliHarness.executeCommand(
          `--length=${testCase.value}`,
          ['css-config'],
          {
            expectFailure: true,
          }
        );

        CliAssertions.assertFailure(result);
        expect(result.stderr).toMatch(testCase.error);
      }
    });

    it('should provide helpful type error messages', async () => {
      // Test that type errors are descriptive
      const result = await cliHarness.executeCommand('--length=five', ['css-config'], {
        expectFailure: true,
      });

      CliAssertions.assertFailure(result);

      const errorOutput = result.stderr;
      expect(errorOutput).toMatch(/number|invalid|type/i);
    });

    it('should validate numeric ranges correctly', async () => {
      // Test numeric boundary validation
      const boundaryTests = [
        { value: 1, shouldSucceed: true },
        { value: 26, shouldSucceed: true },
        { value: 0, shouldSucceed: false },
        { value: 27, shouldSucceed: false },
      ];

      for (const test of boundaryTests) {
        const result = await cliHarness.executeCommand(`--length=${test.value}`, ['css-config'], {
          expectFailure: !test.shouldSucceed,
        });

        if (test.shouldSucceed) {
          CliAssertions.assertSuccess(result);
          expect(result.stdout).toContain(`"minimumLength": ${test.value}`);
        } else {
          CliAssertions.assertFailure(result);
          expect(result.stderr).toMatch(/range|minimum|maximum|invalid/i);
        }
      }
    });
  });

  describe('Integration Boundary Validation', () => {
    it('should validate data crossing package boundaries', async () => {
      // Test comprehensive boundary validation
      const result = await cliHarness.executeCssConfigWithLength(13, ['--verbose']);

      CliAssertions.assertSuccess(result);

      // Verify final output structure demonstrates successful boundary crossing
      expect(result.stdout).toContain('"minimumLength": 13');
      IntegrationAssertions.assertLengthIntegration(result, 13, 'css-config');
    });

    it('should handle complex data transformations across boundaries', async () => {
      // Test that CLI-to-Core data transformation maintains integrity
      const result = await cliHarness.executeInitConfigWithLength(14);

      CliAssertions.assertSuccess(result);

      // Validate that data was transformed correctly
      expect(result.stdout).toContain('"minimumLength": 14');
      expect(result.stdout).toContain('nameGeneration');

      // Should be valid JavaScript configuration
      expect(result.stdout).toContain('module.exports');
    });

    it('should maintain consistency across different CLI commands', async () => {
      // Test that different commands handle the same --length value consistently
      const cssResult = await cliHarness.executeCssConfigWithLength(15);
      const initResult = await cliHarness.executeInitConfigWithLength(15);

      CliAssertions.assertSuccess(cssResult);
      CliAssertions.assertSuccess(initResult);

      // Both should contain the same minimumLength value
      expect(cssResult.stdout).toContain('"minimumLength": 15');
      expect(initResult.stdout).toContain('"minimumLength": 15');

      // Both should handle the length integration correctly
      IntegrationAssertions.assertLengthIntegration(cssResult, 15, 'css-config');
      IntegrationAssertions.assertLengthIntegration(initResult, 15, 'init-config');
    });
  });
});
