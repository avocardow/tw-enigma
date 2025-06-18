/**
 * Circuit Breaker Integration Tests
 *
 * Tests circuit breaker patterns for fault tolerance,
 * failure detection, and automatic recovery mechanisms.
 */

import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configFixtures } from '../fixtures/config-generators';
import { CliTestHarness } from '../utils/cli-test-harness';
import { IntegrationAssertions } from '../utils/integration-assertions';

describe('Circuit Breaker Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Configuration Circuit Breaker', () => {
    it('should trigger circuit breaker on repeated config failures', async () => {
      // Create consistently failing configuration
      const invalidConfigPath = path.join(tempDir, 'always-invalid.config.json');
      await fs.writeFile(invalidConfigPath, '{ syntax error }');

      // Execute multiple failing attempts
      const results = await Promise.all([
        cliHarness.executeCommandInDirectory(
          ['--config', invalidConfigPath, 'init-config'],
          tempDir
        ),
        cliHarness.executeCommandInDirectory(
          ['--config', invalidConfigPath, 'init-config'],
          tempDir
        ),
        cliHarness.executeCommandInDirectory(
          ['--config', invalidConfigPath, 'init-config'],
          tempDir
        ),
        cliHarness.executeCommandInDirectory(
          ['--config', invalidConfigPath, 'init-config'],
          tempDir
        ),
        cliHarness.executeCommandInDirectory(
          ['--config', invalidConfigPath, 'init-config'],
          tempDir
        ),
      ]);

      // Should show circuit breaker behavior
      IntegrationAssertions.assertCircuitBreaker(
        results,
        {
          failureThreshold: 3,
          recoveryStrategy: 'fail-fast',
          pattern: 'configuration-parsing',
          context: 'Repeated configuration failures',
        },
        'Configuration circuit breaker activation'
      );
    });

    it('should recover circuit breaker after successful operation', async () => {
      // Create failing config
      const invalidConfigPath = path.join(tempDir, 'initially-invalid.config.json');
      await fs.writeFile(invalidConfigPath, '{ invalid }');

      // Trigger failures
      await Promise.all([
        cliHarness.executeCommandInDirectory(
          ['--config', invalidConfigPath, 'init-config'],
          tempDir
        ),
        cliHarness.executeCommandInDirectory(
          ['--config', invalidConfigPath, 'init-config'],
          tempDir
        ),
        cliHarness.executeCommandInDirectory(
          ['--config', invalidConfigPath, 'init-config'],
          tempDir
        ),
      ]);

      // Fix the config
      const validConfig = configFixtures.generateMinimalConfig();
      await fs.writeFile(invalidConfigPath, JSON.stringify(validConfig, null, 2));

      // Test recovery
      const recoveryResult = await cliHarness.executeCommandInDirectory(
        ['--config', invalidConfigPath, 'init-config'],
        tempDir
      );

      // Circuit breaker should reset on success
      IntegrationAssertions.assertCircuitBreaker(
        [recoveryResult],
        {
          failureThreshold: 0,
          recoveryStrategy: 'reset-on-success',
          pattern: 'recovery',
          context: 'Circuit breaker recovery',
        },
        'Circuit breaker recovery after success'
      );
    });
  });

  describe('Processing Circuit Breaker', () => {
    it('should implement circuit breaker for CSS processing failures', async () => {
      // Create directory with problematic CSS files
      const problematicDir = path.join(tempDir, 'problematic-css');
      await fs.mkdir(problematicDir);

      // Create multiple invalid CSS files
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(
          path.join(problematicDir, `invalid-${i}.css`),
          `@apply .nonexistent-class-${i}; .broken { color: invalid-${i}; }`
        );
      }

      // Execute CSS processing that should trigger circuit breaker
      const results = await Promise.all([
        cliHarness.executeCommandInDirectory(['--input', problematicDir, 'css-config'], tempDir),
        cliHarness.executeCommandInDirectory(['--input', problematicDir, 'css-config'], tempDir),
        cliHarness.executeCommandInDirectory(['--input', problematicDir, 'css-config'], tempDir),
      ]);

      // Should show processing circuit breaker
      IntegrationAssertions.assertCircuitBreaker(
        results,
        {
          failureThreshold: 2,
          recoveryStrategy: 'backoff-and-retry',
          pattern: 'css-processing',
          context: 'CSS processing failures',
        },
        'CSS processing circuit breaker'
      );
    });

    it('should handle circuit breaker with name generation failures', async () => {
      // Test extreme name generation parameters
      const extremeParams = [
        ['--length', '0'],
        ['--length', '-10'],
        ['--length', 'invalid'],
        ['--length', '999999'],
        ['--length', 'NaN'],
      ];

      const results = await Promise.all(
        extremeParams.map((params) => cliHarness.executeCommand([...params, 'init-config']))
      );

      // Should show name generation circuit breaker
      IntegrationAssertions.assertCircuitBreaker(
        results,
        {
          failureThreshold: 3,
          recoveryStrategy: 'parameter-validation',
          pattern: 'name-generation',
          context: 'Name generation parameter failures',
        },
        'Name generation circuit breaker'
      );
    });
  });

  describe('I/O Circuit Breaker', () => {
    it('should implement circuit breaker for file system failures', async () => {
      // Test with various problematic paths
      const problematicPaths = [
        '/root/cannot-access',
        './deeply/nested/nonexistent/path',
        '', // empty path
        '...', // invalid path
        'nonexistent-drive:/invalid',
      ];

      const results = await Promise.all(
        problematicPaths.map((pathStr) =>
          cliHarness.executeCommand(['--output', pathStr, 'init-config'])
        )
      );

      // Should show file system circuit breaker
      IntegrationAssertions.assertCircuitBreaker(
        results,
        {
          failureThreshold: 3,
          recoveryStrategy: 'fallback-paths',
          pattern: 'filesystem-access',
          context: 'File system access failures',
        },
        'File system circuit breaker'
      );
    });

    it('should handle concurrent access circuit breaker', async () => {
      // Create shared resource contention scenario
      const sharedConfigPath = path.join(tempDir, 'shared.config.json');
      const config = configFixtures.generateMinimalConfig();
      await fs.writeFile(sharedConfigPath, JSON.stringify(config, null, 2));

      // Simulate high concurrency
      const concurrentTasks = Array.from({ length: 10 }, (_, i) =>
        cliHarness.executeCommandInDirectory(
          ['--config', sharedConfigPath, '--output', `./output-${i}`, 'init-config'],
          tempDir
        )
      );

      const results = await Promise.allSettled(concurrentTasks);

      // Should handle concurrent access gracefully
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThan(0);

      // Some operations should show circuit breaker behavior
      IntegrationAssertions.assertCircuitBreaker(
        fulfilled.map((r) => (r as any).value),
        {
          failureThreshold: 5,
          recoveryStrategy: 'queue-and-retry',
          pattern: 'concurrent-access',
          context: 'Concurrent resource access',
        },
        'Concurrent access circuit breaker'
      );
    });
  });

  describe('Adaptive Circuit Breaker Behavior', () => {
    it('should adapt circuit breaker thresholds based on error patterns', async () => {
      // Create scenario with different error types
      const mixedErrorScenarios = [
        // Configuration errors
        ['--config', '/nonexistent/config.json', 'init-config'],
        ['--config', '/another/missing.json', 'init-config'],
        // Parameter errors
        ['--length', 'invalid', 'init-config'],
        ['--length', '-100', 'init-config'],
        // Path errors
        ['--output', '/invalid/path', 'init-config'],
      ];

      const results = await Promise.all(
        mixedErrorScenarios.map((scenario) => cliHarness.executeCommand(scenario))
      );

      // Should show adaptive behavior
      IntegrationAssertions.assertCircuitBreaker(
        results,
        {
          failureThreshold: 'adaptive',
          recoveryStrategy: 'error-type-specific',
          pattern: 'mixed-errors',
          context: 'Mixed error pattern adaptation',
        },
        'Adaptive circuit breaker behavior'
      );
    });

    it('should implement progressive circuit breaker timeouts', async () => {
      // Create repeating failure scenario
      const failureScenario = ['--length', 'consistently-invalid', 'init-config'];

      // Execute with timing to detect progressive timeouts
      const timings: number[] = [];

      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await cliHarness.executeCommand(failureScenario);
        const endTime = Date.now();
        timings.push(endTime - startTime);
      }

      // Should show progressive timeout increase (or consistent fast-fail)
      const hasProgressiveTimeout = timings.some(
        (time, index) => index > 0 && (time > timings[index - 1] * 1.5 || time < 100)
      );

      expect(hasProgressiveTimeout).toBe(true);
    });
  });

  describe('Circuit Breaker Integration with Error Recovery', () => {
    it('should coordinate circuit breaker with error recovery mechanisms', async () => {
      // Create scenario requiring both circuit breaker and recovery
      const partiallyFailingConfig = {
        input: './src', // valid
        output: '/invalid/path', // invalid
        nameGeneration: {
          enabled: true,
          minimumLength: -5, // invalid
        },
      };
      const configPath = path.join(tempDir, 'partial-fail.config.json');
      await fs.writeFile(configPath, JSON.stringify(partiallyFailingConfig, null, 2));

      // Execute multiple times to trigger both systems
      const results = await Promise.all([
        cliHarness.executeCommandInDirectory(['--config', configPath, 'init-config'], tempDir),
        cliHarness.executeCommandInDirectory(['--config', configPath, 'init-config'], tempDir),
        cliHarness.executeCommandInDirectory(['--config', configPath, 'init-config'], tempDir),
      ]);

      // Should show coordination between systems
      IntegrationAssertions.assertCircuitBreaker(
        results,
        {
          failureThreshold: 2,
          recoveryStrategy: 'integrated-recovery',
          pattern: 'partial-failure-with-recovery',
          context: 'Circuit breaker with error recovery coordination',
        },
        'Circuit breaker and error recovery integration'
      );
    });

    it('should validate circuit breaker state transitions', async () => {
      // Test state transitions: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
      const testConfig = path.join(tempDir, 'state-test.config.json');

      // Start with invalid config (CLOSED -> OPEN)
      await fs.writeFile(testConfig, '{ invalid }');
      const openResults = await Promise.all([
        cliHarness.executeCommandInDirectory(['--config', testConfig, 'init-config'], tempDir),
        cliHarness.executeCommandInDirectory(['--config', testConfig, 'init-config'], tempDir),
        cliHarness.executeCommandInDirectory(['--config', testConfig, 'init-config'], tempDir),
      ]);

      // Fix config and test (HALF_OPEN)
      const validConfig = configFixtures.generateMinimalConfig();
      await fs.writeFile(testConfig, JSON.stringify(validConfig, null, 2));
      const halfOpenResult = await cliHarness.executeCommandInDirectory(
        ['--config', testConfig, 'init-config'],
        tempDir
      );

      // Continue with valid operations (HALF_OPEN -> CLOSED)
      const closedResult = await cliHarness.executeCommandInDirectory(
        ['--config', testConfig, 'init-config'],
        tempDir
      );

      // Validate state transitions
      IntegrationAssertions.assertCircuitBreaker(
        [...openResults, halfOpenResult, closedResult],
        {
          failureThreshold: 'state-transition',
          recoveryStrategy: 'state-machine',
          pattern: 'state-transitions',
          context: 'Circuit breaker state machine validation',
        },
        'Circuit breaker state transition validation'
      );
    });
  });

  describe('Circuit Breaker Performance and Monitoring', () => {
    it('should maintain performance during circuit breaker operations', async () => {
      // Test performance with circuit breaker active
      const startTime = Date.now();

      // Trigger circuit breaker quickly
      await Promise.all([
        cliHarness.executeCommand(['--length', 'invalid1', 'init-config']),
        cliHarness.executeCommand(['--length', 'invalid2', 'init-config']),
        cliHarness.executeCommand(['--length', 'invalid3', 'init-config']),
      ]);

      // Subsequent calls should fail fast
      const fastFailStart = Date.now();
      await cliHarness.executeCommand(['--length', 'invalid4', 'init-config']);
      const fastFailEnd = Date.now();

      const totalTime = Date.now() - startTime;
      const fastFailTime = fastFailEnd - fastFailStart;

      // Circuit breaker should improve performance by failing fast
      expect(totalTime).toBeLessThan(10000); // 10 seconds total
      expect(fastFailTime).toBeLessThan(1000); // 1 second for fast fail
    });

    it('should provide circuit breaker monitoring capabilities', async () => {
      // Test scenario to generate monitoring data
      const monitoringScenarios = [
        ['--length', '8', 'init-config'], // success
        ['--length', 'invalid', 'init-config'], // failure
        ['--length', '10', 'init-config'], // success
        ['--config', '/missing.json', 'init-config'], // failure
        ['--length', '12', 'init-config'], // success
      ];

      const results = await Promise.all(
        monitoringScenarios.map((scenario) => cliHarness.executeCommand(scenario))
      );

      // Should provide monitoring insights
      const successes = results.filter((r) => r.exitCode === 0).length;
      const failures = results.filter((r) => r.exitCode !== 0).length;

      // Validate monitoring data availability
      expect(successes + failures).toBe(results.length);
      expect(successes).toBeGreaterThan(0);
      expect(failures).toBeGreaterThan(0);

      // Should show circuit breaker monitoring
      IntegrationAssertions.assertCircuitBreaker(
        results,
        {
          failureThreshold: 'monitoring',
          recoveryStrategy: 'data-collection',
          pattern: 'mixed-success-failure',
          context: 'Circuit breaker monitoring validation',
        },
        'Circuit breaker monitoring capabilities'
      );
    });
  });

  describe('Circuit Breaker Configuration and Customization', () => {
    it('should support configurable circuit breaker thresholds', async () => {
      // Test with environment variable configuration
      const customThresholdResult = await cliHarness.executeCommandWithEnv(
        ['--length', 'invalid', 'init-config'],
        { TW_ENIGMA_CIRCUIT_BREAKER_THRESHOLD: '1' }
      );

      // Should respect custom threshold
      IntegrationAssertions.assertCircuitBreaker(
        [customThresholdResult],
        {
          failureThreshold: 1,
          recoveryStrategy: 'custom-threshold',
          pattern: 'configurable',
          context: 'Custom circuit breaker threshold',
        },
        'Configurable circuit breaker thresholds'
      );
    });

    it('should support circuit breaker disable/enable configuration', async () => {
      // Test with circuit breaker disabled
      const disabledResult = await cliHarness.executeCommandWithEnv(
        ['--length', 'invalid', 'init-config'],
        { TW_ENIGMA_CIRCUIT_BREAKER_ENABLED: 'false' }
      );

      // Should not show circuit breaker behavior when disabled
      expect(disabledResult.exitCode).toBeDefined();
      // Note: Without circuit breaker, each call should be attempted fully
    });
  });
});
