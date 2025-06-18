/**
 * Error Handling Flow Integration Test
 *
 * Tests the internal integration points for error handling within the Core package:
 * - Error capture and categorization
 * - Error propagation through the system
 * - Recovery mechanism integration
 * - Logging and reporting integration
 * - Circuit breaker functionality
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configFixtures } from '../fixtures/config-generators';
import { IntegrationAssertions, IntegrationTestData } from '../utils/integration-assertions';

describe('Error Handling Flow Integration', () => {
  beforeEach(() => {
    // Reset error handler state
  });

  afterEach(() => {
    // Clean up any error state
  });

  describe('Error Capture Integration', () => {
    it('should capture configuration errors correctly', async () => {
      const invalidConfigs = [{ pretty: 'invalid' }, { minify: 123 }, { removeUnused: null }];

      for (const invalidConfig of invalidConfigs) {
        try {
          IntegrationAssertions.assertConfigurationValid(invalidConfig as any);
          expect.fail('Should have thrown error');
        } catch (error) {
          expect(error).toBeDefined();
          expect(error.message).toBeTruthy();

          IntegrationAssertions.assertErrorPropagation(
            { stderr: error.message } as any,
            'configuration'
          );
        }
      }
    });

    it('should capture validation errors with context', async () => {
      const testCases = [
        {
          config: { pretty: 'yes' },
          expectedField: 'pretty',
        },
        {
          config: { minimumLength: -1 },
          expectedField: 'minimumLength',
        },
      ];

      for (const testCase of testCases) {
        try {
          if ('minimumLength' in testCase.config) {
            configFixtures.generateConfigWithNameGeneration(testCase.config as any);
          } else {
            IntegrationAssertions.assertConfigurationValid(testCase.config as any);
          }
          expect.fail('Should have thrown error');
        } catch (error) {
          expect(error.message).toMatch(new RegExp(testCase.expectedField, 'i'));
        }
      }
    });

    it('should capture processing errors during name generation', async () => {
      // Test error scenarios in name generation
      const errorScenarios = [
        {
          description: 'invalid strategy',
          config: { strategy: 'invalid' },
          expectedError: /strategy/i,
        },
        {
          description: 'missing alphabet',
          config: { strategy: 'alphabet', minimumLength: 5 },
          expectedError: /alphabet/i,
        },
      ];

      for (const scenario of errorScenarios) {
        try {
          configFixtures.generateConfigWithNameGeneration(scenario.config as any);
          expect.fail(`Should have thrown error for ${scenario.description}`);
        } catch (error) {
          expect(error.message).toMatch(scenario.expectedError);

          // Verify error contains processing context
          IntegrationAssertions.assertErrorContext(error, 'name-generation');
        }
      }
    });
  });

  describe('Error Propagation Integration', () => {
    it('should propagate errors through validation chain', async () => {
      const nestedConfig = {
        pretty: true,
        nameGeneration: {
          minimumLength: 0,
          strategy: 'sequential',
        },
      };

      try {
        const config = configFixtures.mergeWithDefaults(nestedConfig);
        IntegrationAssertions.assertConfigurationValid(config);
        expect.fail('Should have thrown nested error');
      } catch (error) {
        expect(error.message).toMatch(/nameGeneration|minimumLength/i);

        IntegrationAssertions.assertErrorPropagation(
          { stderr: error.message } as any,
          'validation'
        );
      }
    });

    it('should maintain error stack traces', async () => {
      try {
        IntegrationAssertions.assertConfigurationValid({ pretty: 'invalid' });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('assertConfigurationValid');

        IntegrationAssertions.assertErrorStackTrace(error, [
          'assertConfigurationValid',
          'validation',
        ]);
      }
    });

    it('should aggregate multiple validation errors', async () => {
      const multipleErrorsConfig = {
        pretty: 'invalid',
        minify: 123,
        removeUnused: 'yes',
        nameGeneration: {
          minimumLength: 0,
          strategy: 'invalid',
        },
      };

      try {
        const config = configFixtures.mergeWithDefaults(multipleErrorsConfig);
        IntegrationAssertions.assertConfigurationValid(config);
        expect.fail('Should have thrown aggregated errors');
      } catch (error) {
        // Verify multiple error contexts
        const errorFields = ['pretty', 'minify', 'removeUnused', 'minimumLength', 'strategy'];

        for (const field of errorFields) {
          expect(error.message).toMatch(new RegExp(field, 'i'));
        }

        IntegrationAssertions.assertErrorAggregation(error, errorFields.length);
      }
    });
  });

  describe('Recovery Mechanism Integration', () => {
    it('should attempt recovery for recoverable errors', async () => {
      const recoverableScenarios = [
        {
          description: 'type coercion',
          input: { pretty: 'true' },
          expectedRecovery: { pretty: true },
        },
      ];

      for (const scenario of recoverableScenarios) {
        try {
          const config = configFixtures.mergeWithDefaults(scenario.input, {
            attemptRecovery: true,
          });

          IntegrationAssertions.assertConfigurationValid(config);

          const recoveredValue =
            config[Object.keys(scenario.expectedRecovery)[0] as keyof typeof config];
          expect(recoveredValue).toEqual(Object.values(scenario.expectedRecovery)[0]);
        } catch (error) {
          expect(error.message).toMatch(/recovery|coercion|conversion/i);
        }
      }
    });

    it('should not attempt recovery for non-recoverable errors', async () => {
      const nonRecoverableErrors = [
        { pretty: { complex: 'object' } },
        { nameGeneration: 'completely wrong type' },
      ];

      for (const errorConfig of nonRecoverableErrors) {
        try {
          configFixtures.mergeWithDefaults(errorConfig, { attemptRecovery: true });
          expect.fail('Should not have recovered from non-recoverable error');
        } catch (error) {
          expect(error.message).not.toMatch(/recovered|coerced/i);
          IntegrationAssertions.assertNoRecoveryAttempted(error);
        }
      }
    });

    it('should track recovery attempts and success rates', async () => {
      const recoveryAttempts = [
        { input: { pretty: 'true' }, shouldSucceed: true },
        { input: { minify: 'false' }, shouldSucceed: true },
        { input: { pretty: 'invalid' }, shouldSucceed: false },
        { input: { minify: 123 }, shouldSucceed: false },
      ];

      let successCount = 0;
      let attemptCount = 0;

      for (const attempt of recoveryAttempts) {
        attemptCount++;
        try {
          const config = configFixtures.mergeWithDefaults(attempt.input, { attemptRecovery: true });

          IntegrationAssertions.assertConfigurationValid(config);
          successCount++;
          expect(attempt.shouldSucceed).toBe(true);
        } catch (error) {
          expect(attempt.shouldSucceed).toBe(false);
        }
      }

      // Verify recovery metrics
      const expectedSuccessRate =
        recoveryAttempts.filter((a) => a.shouldSucceed).length / attemptCount;
      const actualSuccessRate = successCount / attemptCount;

      expect(actualSuccessRate).toBe(expectedSuccessRate);
      IntegrationAssertions.assertRecoveryMetrics(successCount, attemptCount);
    });
  });

  describe('Logging Integration', () => {
    it('should log errors with appropriate severity levels', async () => {
      const errorLevels = [
        { config: { pretty: 'invalid' }, expectedLevel: 'warn' },
        { config: { nameGeneration: null }, expectedLevel: 'error' },
      ];

      for (const testCase of errorLevels) {
        try {
          IntegrationAssertions.assertConfigurationValid(testCase.config as any);
          expect.fail('Should have logged error');
        } catch (error) {
          IntegrationAssertions.assertErrorLogged(error, testCase.expectedLevel);
        }
      }
    });

    it('should include contextual information in error logs', async () => {
      try {
        IntegrationAssertions.assertConfigurationValid({ pretty: 'yes' });
        expect.fail('Should have logged contextual error');
      } catch (error) {
        IntegrationAssertions.assertErrorContext(error, 'field:pretty');
        IntegrationAssertions.assertErrorContext(error, 'type:boolean');
      }
    });

    it('should support structured error reporting', async () => {
      try {
        const invalidConfig = {
          pretty: 'invalid',
          nameGeneration: {
            minimumLength: 0,
            strategy: 'unknown',
          },
        };

        const config = configFixtures.mergeWithDefaults(invalidConfig);
        IntegrationAssertions.assertConfigurationValid(config);
        expect.fail('Should have generated structured error');
      } catch (error) {
        // Verify structured error format
        IntegrationAssertions.assertStructuredError(error, {
          type: 'ValidationError',
          fields: ['pretty', 'minimumLength', 'strategy'],
          severity: 'error',
          recoverable: false,
        });
      }
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should implement circuit breaker for repeated errors', async () => {
      const errorConfig = { pretty: 'invalid' };
      const errorThreshold = 5;
      let errorCount = 0;

      for (let i = 0; i < errorThreshold + 2; i++) {
        try {
          IntegrationAssertions.assertConfigurationValid(errorConfig as any);
          expect.fail('Should have thrown error');
        } catch (error) {
          errorCount++;

          if (errorCount >= errorThreshold) {
            IntegrationAssertions.assertCircuitBreakerActive(error);
            expect(error.message).toMatch(/circuit.*breaker|too.*many.*errors/i);
          } else {
            IntegrationAssertions.assertCircuitBreakerInactive(error);
          }
        }
      }

      expect(errorCount).toBeGreaterThanOrEqual(errorThreshold);
    });

    it('should reset circuit breaker after cool-down period', async () => {
      const errorConfig = { minify: 'invalid' };

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          IntegrationAssertions.assertConfigurationValid(errorConfig as any);
        } catch (error) {
          // Expected errors
        }
      }

      // Wait for cool-down (simulated)
      await IntegrationTestData.waitForCoolDown(1000);

      // Try again - circuit breaker should be reset
      try {
        IntegrationAssertions.assertConfigurationValid(errorConfig as any);
        expect.fail('Should still throw validation error');
      } catch (error) {
        // Should be normal validation error, not circuit breaker error
        IntegrationAssertions.assertCircuitBreakerInactive(error);
        expect(error.message).not.toMatch(/circuit.*breaker/i);
      }
    });

    it('should differentiate circuit breaker by error type', async () => {
      const configErrors = [{ pretty: 'invalid' }, { minify: 123 }];

      const nameGenErrors = [{ minimumLength: 0 }, { strategy: 'invalid' }];

      // Trigger circuit breaker for config errors
      for (let i = 0; i < 5; i++) {
        for (const errorConfig of configErrors) {
          try {
            IntegrationAssertions.assertConfigurationValid(errorConfig as any);
          } catch (error) {
            // Expected
          }
        }
      }

      // Name generation errors should still work
      for (const nameGenError of nameGenErrors) {
        try {
          configFixtures.generateConfigWithNameGeneration(nameGenError as any);
          expect.fail('Should throw validation error');
        } catch (error) {
          // Should be normal error, not circuit breaker
          IntegrationAssertions.assertCircuitBreakerInactive(error);
          IntegrationAssertions.assertErrorType(error, 'name-generation');
        }
      }
    });
  });

  describe('Performance Error Handling', () => {
    it('should handle errors efficiently', async () => {
      const errors = Array.from({ length: 100 }, () => ({ pretty: 'invalid' }));

      const startTime = Date.now();

      for (const errorConfig of errors) {
        try {
          IntegrationAssertions.assertConfigurationValid(errorConfig as any);
        } catch (error) {
          // Expected errors
        }
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    });

    it('should not leak memory during error handling', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate many errors
      for (let i = 0; i < 500; i++) {
        try {
          IntegrationAssertions.assertConfigurationValid({ pretty: `invalid-${i}` } as any);
        } catch (error) {
          // Expected errors
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
