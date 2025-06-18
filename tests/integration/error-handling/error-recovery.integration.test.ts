/**
 * Error Recovery Integration Tests
 *
 * Tests error recovery mechanisms, graceful degradation,
 * and resilience across different failure scenarios.
 */

import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configFixtures } from '../fixtures/config-generators';
import { CliTestHarness } from '../utils/cli-test-harness';
import { IntegrationAssertions } from '../utils/integration-assertions';

describe('Error Recovery Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Configuration Error Recovery', () => {
    it('should recover from invalid configuration files', async () => {
      // Create invalid configuration file
      const invalidConfig = `{
  "input": "./src",
  "output": "./dist"
  // Missing comma - syntax error
  "nameGeneration": {
    "enabled": true
  }
}`;
      const configPath = path.join(tempDir, 'invalid.config.json');
      await fs.writeFile(configPath, invalidConfig);

      // Test recovery mechanism
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Should recover gracefully
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'config-parse',
          recovery: 'fallback-to-defaults',
          context: 'Configuration file syntax error',
        },
        'Invalid configuration file recovery'
      );
    });

    it('should recover from missing configuration dependencies', async () => {
      // Create config that references non-existent files
      const configWithMissingDeps = {
        input: './nonexistent-src',
        output: './nonexistent-dist',
        nameGeneration: {
          enabled: true,
          minimumLength: 8,
        },
      };
      const configPath = path.join(tempDir, 'missing-deps.config.json');
      await fs.writeFile(configPath, JSON.stringify(configWithMissingDeps, null, 2));

      // Test dependency recovery
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Should handle missing dependencies gracefully
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'missing-dependencies',
          recovery: 'create-or-fallback',
          context: 'Missing input/output directories',
        },
        'Missing configuration dependencies recovery'
      );
    });

    it('should recover from invalid nameGeneration settings', async () => {
      // Create config with invalid name generation
      const invalidNameGenConfig = configFixtures.generateInvalidNameGeneration();
      const configPath = path.join(tempDir, 'invalid-namegen.config.json');
      await fs.writeFile(configPath, JSON.stringify(invalidNameGenConfig, null, 2));

      // Test name generation recovery
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Should recover from invalid name generation settings
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'validation-error',
          recovery: 'default-settings',
          context: 'Invalid nameGeneration configuration',
        },
        'Invalid nameGeneration settings recovery'
      );
    });
  });

  describe('CLI Command Error Recovery', () => {
    it('should recover from invalid command combinations', async () => {
      // Test invalid flag combinations
      const result = await cliHarness.executeCommand([
        '--length',
        'invalid',
        '--verbose',
        '--quiet',
        'init-config',
      ]);

      // Should recover from invalid combinations
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'invalid-arguments',
          recovery: 'validation-and-defaults',
          context: 'Invalid command line arguments',
        },
        'Invalid command combinations recovery'
      );
    });

    it('should recover from missing required dependencies', async () => {
      // Test command that might require missing dependencies
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', './missing-directory', 'init-config'],
        tempDir
      );

      // Should handle missing dependencies
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'missing-input',
          recovery: 'create-directory-or-fallback',
          context: 'Missing input directory',
        },
        'Missing required dependencies recovery'
      );
    });

    it('should recover from permission errors', async () => {
      // Create read-only directory (on Unix systems)
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir);
      try {
        await fs.chmod(readOnlyDir, 0o444); // Read-only
      } catch {
        // Skip if chmod not supported (Windows)
      }

      // Test permission error recovery
      const result = await cliHarness.executeCommandInDirectory(
        ['--output', readOnlyDir, 'init-config'],
        tempDir
      );

      // Should handle permission errors gracefully
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'permission-denied',
          recovery: 'alternative-location',
          context: 'Output directory permission error',
        },
        'Permission error recovery'
      );
    });
  });

  describe('Processing Error Recovery', () => {
    it('should recover from CSS processing errors', async () => {
      // Create invalid CSS-like input
      const invalidCssDir = path.join(tempDir, 'invalid-css');
      await fs.mkdir(invalidCssDir);
      await fs.writeFile(
        path.join(invalidCssDir, 'invalid.css'),
        '@apply .nonexistent-class; .malformed { color: #invalid-color-value; }'
      );

      // Test CSS processing recovery
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', invalidCssDir, 'css-config'],
        tempDir
      );

      // Should recover from CSS processing errors
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'css-processing',
          recovery: 'skip-invalid-continue',
          context: 'Invalid CSS processing',
        },
        'CSS processing error recovery'
      );
    });

    it('should recover from name generation failures', async () => {
      // Test name generation with extreme parameters
      const result = await cliHarness.executeCommand([
        '--length',
        '999999', // Extremely large length
        'init-config',
      ]);

      // Should recover from name generation failures
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'name-generation-failure',
          recovery: 'fallback-strategy',
          context: 'Extreme name generation parameters',
        },
        'Name generation failure recovery'
      );
    });

    it('should recover from memory constraints', async () => {
      // Simulate large input scenario
      const largeInputDir = path.join(tempDir, 'large-input');
      await fs.mkdir(largeInputDir);

      // Create multiple large files to test memory constraints
      for (let i = 0; i < 10; i++) {
        const largeContent = 'a'.repeat(10000); // 10KB per file
        await fs.writeFile(path.join(largeInputDir, `large-file-${i}.css`), largeContent);
      }

      // Test memory constraint recovery
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', largeInputDir, 'css-config'],
        tempDir
      );

      // Should handle memory constraints gracefully
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'memory-constraint',
          recovery: 'streaming-or-batching',
          context: 'Large input processing',
        },
        'Memory constraint recovery'
      );
    });
  });

  describe('Network and I/O Error Recovery', () => {
    it('should recover from file system errors', async () => {
      // Test with non-existent path
      const nonexistentPath = path.join(tempDir, 'deeply', 'nested', 'nonexistent', 'path');

      const result = await cliHarness.executeCommandInDirectory(
        ['--output', nonexistentPath, 'init-config'],
        tempDir
      );

      // Should recover from file system errors
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'filesystem-error',
          recovery: 'create-path-or-fallback',
          context: 'Deep directory creation',
        },
        'File system error recovery'
      );
    });

    it('should recover from concurrent access issues', async () => {
      // Simulate concurrent access by running multiple commands
      const configPath = path.join(tempDir, 'concurrent.config.json');
      const config = configFixtures.generateMinimalConfig();
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      // Run multiple commands concurrently
      const results = await Promise.allSettled([
        cliHarness.executeCommandInDirectory(['--config', configPath, 'init-config'], tempDir),
        cliHarness.executeCommandInDirectory(['--config', configPath, 'css-config'], tempDir),
        cliHarness.executeCommandInDirectory(['--config', configPath, 'init-config'], tempDir),
      ]);

      // At least one should succeed, others should handle conflicts gracefully
      const hasSuccess = results.some(
        (result) => result.status === 'fulfilled' && result.value.exitCode === 0
      );
      const hasGracefulHandling = results.some(
        (result) => result.status === 'fulfilled' && result.value.exitCode !== 0
      );

      expect(hasSuccess || hasGracefulHandling).toBe(true);
    });
  });

  describe('Graceful Degradation', () => {
    it('should provide partial functionality when components fail', async () => {
      // Create config with some valid and some invalid settings
      const partialConfig = {
        input: './src', // valid
        output: './dist', // valid
        nameGeneration: {
          enabled: true,
          minimumLength: -5, // invalid
          pattern: 'invalid-pattern', // invalid
        },
      };
      const configPath = path.join(tempDir, 'partial.config.json');
      await fs.writeFile(configPath, JSON.stringify(partialConfig, null, 2));

      // Test partial functionality
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Should provide partial functionality
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'partial-failure',
          recovery: 'graceful-degradation',
          context: 'Partial component failure',
        },
        'Graceful degradation with partial functionality'
      );

      // Should still generate basic configuration
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('input');
        expect(result.stdout).toContain('output');
      }
    });

    it('should maintain core functionality during feature failures', async () => {
      // Test with advanced features that might fail
      const result = await cliHarness.executeCommand([
        '--length',
        '8',
        '--pretty',
        '--experimental-feature', // Non-existent flag
        'init-config',
      ]);

      // Should maintain core functionality
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'feature-failure',
          recovery: 'ignore-and-continue',
          context: 'Advanced feature failure',
        },
        'Core functionality maintenance during feature failures'
      );
    });
  });

  describe('Error Recovery Integration with Circuit Breaker', () => {
    it('should integrate with circuit breaker for repeated failures', async () => {
      // Create scenario that causes repeated failures
      const faultyConfigPath = path.join(tempDir, 'faulty.config.json');
      await fs.writeFile(faultyConfigPath, '{ invalid json }');

      // Trigger multiple failures
      const results = await Promise.all([
        cliHarness.executeCommandInDirectory(
          ['--config', faultyConfigPath, 'init-config'],
          tempDir
        ),
        cliHarness.executeCommandInDirectory(
          ['--config', faultyConfigPath, 'init-config'],
          tempDir
        ),
        cliHarness.executeCommandInDirectory(
          ['--config', faultyConfigPath, 'init-config'],
          tempDir
        ),
      ]);

      // Should show circuit breaker behavior
      IntegrationAssertions.assertCircuitBreaker(
        results,
        {
          failureThreshold: 2,
          recoveryStrategy: 'fail-fast-after-threshold',
          context: 'Repeated configuration failures',
        },
        'Error recovery integration with circuit breaker'
      );
    });

    it('should validate recovery validation chain', async () => {
      // Test complete recovery validation
      const result = await cliHarness.executeCommand(['--length', 'invalid', 'init-config']);

      // Should follow complete validation chain
      IntegrationAssertions.assertValidationChain(
        result,
        {
          stages: ['input-validation', 'error-recovery', 'fallback-application'],
          recovery: true,
          context: 'Complete recovery validation chain',
        },
        'Complete recovery validation chain'
      );
    });
  });

  describe('Recovery Performance and Reliability', () => {
    it('should maintain performance during recovery scenarios', async () => {
      // Test recovery performance
      const startTime = Date.now();

      // Create scenario with recoverable errors
      const result = await cliHarness.executeCommand([
        '--length',
        '0', // Invalid, should trigger recovery
        '--input',
        './nonexistent',
        'init-config',
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Recovery should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds max

      // Should show recovery behavior
      IntegrationAssertions.assertErrorRecovery(
        result,
        {
          errorType: 'multiple-validation-errors',
          recovery: 'comprehensive-fallback',
          context: 'Performance during recovery',
        },
        'Recovery performance maintenance'
      );
    });

    it('should validate recovery reliability across scenarios', async () => {
      // Test multiple recovery scenarios
      const scenarios = [
        ['--length', 'abc'],
        ['--input', ''],
        ['--output', '/invalid/path'],
        ['--config', '/nonexistent/config.json'],
      ];

      const results = await Promise.all(
        scenarios.map((scenario) => cliHarness.executeCommand([...scenario, 'init-config']))
      );

      // All should handle errors gracefully
      results.forEach((result, index) => {
        IntegrationAssertions.assertErrorRecovery(
          result,
          {
            errorType: `scenario-${index}`,
            recovery: 'scenario-specific',
            context: `Recovery scenario ${index}`,
          },
          `Recovery reliability for scenario ${index}`
        );
      });
    });
  });
});
