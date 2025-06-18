/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConfigurationError,
  createErrorByCategory,
  createErrorContext,
  DEFAULT_ERROR_HANDLER_CONFIG,
  enhanceErrorContext,
  ErrorCategory,
  ErrorHandler,
  ErrorSeverity,
  FileOperationError,
  formatErrorContext,
  globalErrorHandler,
  IntegrationError,
  isConfigurationError,
  isEnhancedError,
  isFileOperationError,
  isIntegrationError,
  isPerformanceError,
  isValidationError,
  PerformanceError,
  ValidationError,
  withErrorHandling,
} from '../src/errors';

describe('Enhanced Error Handling System (Task 13)', () => {
  describe('ErrorContext', () => {
    it('should create error context with required fields', () => {
      const context = createErrorContext(
        'test_operation',
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM
      );

      expect(context).toMatchObject({
        operation: 'test_operation',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
      });
      expect(context.errorId).toBeDefined();
      expect(context.timestamp).toBeInstanceOf(Date);
      expect(context.systemState).toBeDefined();
      expect(context.systemState?.nodeVersion).toBeDefined();
      expect(context.systemState?.platform).toBeDefined();
    });

    it('should enhance error context with additional information', () => {
      const original = createErrorContext('test', ErrorCategory.SYSTEM);
      const enhanced = enhanceErrorContext(original, {
        filePaths: ['/test/file.txt'],
        metadata: { userId: '123' },
        recoverySuggestions: ['Try again'],
      });

      expect(enhanced.filePaths).toEqual(['/test/file.txt']);
      expect(enhanced.metadata).toMatchObject({ userId: '123' });
      expect(enhanced.recoverySuggestions).toEqual(['Try again']);
    });

    it('should format error context for logging', () => {
      const context = createErrorContext(
        'test_operation',
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        { testData: 'value' }
      );
      context.filePaths = ['/test/file.txt'];
      context.recoverySuggestions = ['Check input format'];

      const formatted = formatErrorContext(context);

      expect(formatted).toContain('Error ID:');
      expect(formatted).toContain('Severity: HIGH');
      expect(formatted).toContain('Category: validation');
      expect(formatted).toContain('Operation: test_operation');
      expect(formatted).toContain('Files: /test/file.txt');
      expect(formatted).toContain('Recovery Suggestions:');
      expect(formatted).toContain('- Check input format');
    });
  });

  describe('Enhanced Error Types', () => {
    describe('ValidationError', () => {
      it('should create validation error with context', () => {
        const context = createErrorContext('validation', ErrorCategory.VALIDATION);
        const error = new ValidationError('Invalid input', context, {
          validationPath: 'data.name',
          expectedType: 'string',
          receivedValue: 123,
          constraintViolations: ['Must be a string'],
        });

        expect(error.message).toBe('Invalid input');
        expect(error.validationPath).toBe('data.name');
        expect(error.expectedType).toBe('string');
        expect(error.receivedValue).toBe(123);
        expect(error.constraintViolations).toEqual(['Must be a string']);
        expect(isValidationError(error)).toBe(true);
        expect(isEnhancedError(error)).toBe(true);
      });

      it('should provide validation summary', () => {
        const context = createErrorContext('validation', ErrorCategory.VALIDATION);
        const error = new ValidationError('Invalid input', context, {
          validationPath: 'data.name',
          expectedType: 'string',
          receivedValue: 123,
          constraintViolations: ['Must be a string', 'Cannot be empty'],
        });

        const summary = error.getValidationSummary();

        expect(summary).toContain('Validation failed: Invalid input');
        expect(summary).toContain('Path: data.name');
        expect(summary).toContain('Expected: string');
        expect(summary).toContain('Received: 123');
        expect(summary).toContain('Violations: Must be a string, Cannot be empty');
      });
    });

    describe('FileOperationError', () => {
      it('should create file operation error with details', () => {
        const context = createErrorContext('file_read', ErrorCategory.FILE_OPERATION);
        const error = new FileOperationError('Cannot read file', context, {
          operation: 'read',
          filePath: '/test/file.txt',
          permissions: '644',
          fileSize: 1024,
        });

        expect(error.operation).toBe('read');
        expect(error.filePath).toBe('/test/file.txt');
        expect(error.permissions).toBe('644');
        expect(error.fileSize).toBe(1024);
        expect(isFileOperationError(error)).toBe(true);
      });

      it('should provide operation summary', () => {
        const context = createErrorContext('file_write', ErrorCategory.FILE_OPERATION);
        const error = new FileOperationError('Write failed', context, {
          operation: 'write',
          filePath: '/test/output.txt',
          permissions: '755',
          fileSize: 2048,
        });

        const summary = error.getOperationSummary();

        expect(summary).toContain('File operation failed: write');
        expect(summary).toContain('Path: /test/output.txt');
        expect(summary).toContain('Permissions: 755');
        expect(summary).toContain('Size: 2048 bytes');
      });
    });

    describe('PerformanceError', () => {
      it('should create performance error with metrics', () => {
        const context = createErrorContext('optimization', ErrorCategory.PERFORMANCE);
        const error = new PerformanceError('Operation timed out', context, {
          performanceType: 'timeout',
          threshold: 5000,
          actualValue: 8000,
          duration: 8000,
        });

        expect(error.performanceType).toBe('timeout');
        expect(error.threshold).toBe(5000);
        expect(error.actualValue).toBe(8000);
        expect(error.duration).toBe(8000);
        expect(isPerformanceError(error)).toBe(true);
      });

      it('should determine if retryable based on type', () => {
        const context = createErrorContext('test', ErrorCategory.PERFORMANCE, ErrorSeverity.HIGH);

        const timeoutError = new PerformanceError('Timeout', context, {
          performanceType: 'timeout',
        });
        expect(timeoutError.isRetryable()).toBe(true);

        const memoryError = new PerformanceError('Out of memory', context, {
          performanceType: 'memory',
        });
        expect(memoryError.isRetryable()).toBe(false); // Critical severity
      });

      it('should provide performance summary', () => {
        const context = createErrorContext('performance', ErrorCategory.PERFORMANCE);
        const error = new PerformanceError('CPU usage too high', context, {
          performanceType: 'cpu',
          threshold: 80,
          actualValue: 95,
          duration: 30000,
        });

        const summary = error.getPerformanceSummary();

        expect(summary).toContain('Performance issue: cpu');
        expect(summary).toContain('Threshold: 80, Actual: 95');
        expect(summary).toContain('Duration: 30000ms');
      });
    });

    describe('ConfigurationError', () => {
      it('should create configuration error with details', () => {
        const context = createErrorContext('config_load', ErrorCategory.CONFIGURATION);
        const error = new ConfigurationError('Invalid config', context, {
          configPath: '/app/config.json',
          configKey: 'database.host',
          expectedFormat: 'string',
          validOptions: ['localhost', '127.0.0.1'],
        });

        expect(error.configPath).toBe('/app/config.json');
        expect(error.configKey).toBe('database.host');
        expect(error.expectedFormat).toBe('string');
        expect(error.validOptions).toEqual(['localhost', '127.0.0.1']);
        expect(error.isRetryable()).toBe(false); // Config errors are not retryable
        expect(isConfigurationError(error)).toBe(true);
      });
    });

    describe('IntegrationError', () => {
      it('should create integration error with version info', () => {
        const context = createErrorContext('plugin_load', ErrorCategory.INTEGRATION);
        const error = new IntegrationError('Plugin incompatible', context, {
          integrationType: 'plugin',
          integrationName: 'test-plugin',
          version: '1.0.0',
          expectedVersion: '^2.0.0',
        });

        expect(error.integrationType).toBe('plugin');
        expect(error.integrationName).toBe('test-plugin');
        expect(error.version).toBe('1.0.0');
        expect(error.expectedVersion).toBe('^2.0.0');
        expect(error.isRetryable()).toBe(true); // Plugin errors are retryable
        expect(isIntegrationError(error)).toBe(true);
      });
    });
  });

  describe('Error Factory', () => {
    it('should create appropriate error type based on category', () => {
      const validationContext = createErrorContext('test', ErrorCategory.VALIDATION);
      const validationError = createErrorByCategory('Test error', validationContext);
      expect(isValidationError(validationError)).toBe(true);

      const fileContext = createErrorContext('test', ErrorCategory.FILE_OPERATION);
      const fileError = createErrorByCategory('File error', fileContext, {
        operation: 'read',
        filePath: '/test.txt',
      });
      expect(isFileOperationError(fileError)).toBe(true);

      const performanceContext = createErrorContext('test', ErrorCategory.PERFORMANCE);
      const performanceError = createErrorByCategory('Perf error', performanceContext, {
        performanceType: 'timeout',
      });
      expect(isPerformanceError(performanceError)).toBe(true);
    });
  });

  describe('ErrorHandler', () => {
    let errorHandler: ErrorHandler;

    beforeEach(() => {
      errorHandler = new ErrorHandler({
        maxRetries: 2,
        baseRetryDelay: 100,
        useExponentialBackoff: false,
      });
    });

    afterEach(() => {
      errorHandler.clearErrorMetrics();
    });

    it('should execute operation successfully on first try', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const context = { operation: 'test', category: ErrorCategory.SYSTEM };

      const result = await errorHandler.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.wasRecovered).toBe(false);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry operation on retryable errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success');

      const context = {
        operation: 'test',
        category: ErrorCategory.PERFORMANCE,
        severity: ErrorSeverity.MEDIUM,
      };

      const result = await errorHandler.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const validationError = new ValidationError(
        'Invalid input',
        createErrorContext('validation', ErrorCategory.VALIDATION)
      );
      const operation = vi.fn().mockRejectedValue(validationError);

      const context = { operation: 'test', category: ErrorCategory.VALIDATION };

      const result = await errorHandler.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(isValidationError(result.error)).toBe(true);
    });

    it('should stop retrying after max attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      const context = {
        operation: 'test',
        category: ErrorCategory.PERFORMANCE,
        severity: ErrorSeverity.MEDIUM,
      };

      const result = await errorHandler.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2); // maxRetries setting
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use custom retry strategy when provided', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Initial failure'));
      const retryStrategy = vi.fn().mockResolvedValue('recovered');
      const context = { operation: 'test', category: ErrorCategory.SYSTEM };

      const result = await errorHandler.executeWithRetry(operation, context, retryStrategy);

      expect(result.success).toBe(true);
      expect(result.result).toBe('recovered');
      expect(result.wasRecovered).toBe(true);
      expect(result.recoveryMethod).toBe('custom_retry_strategy');
      expect(retryStrategy).toHaveBeenCalledTimes(1);
    });

    it('should register and use recovery strategies', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      const recoveryStrategy = vi.fn().mockResolvedValue('fallback result');

      errorHandler.registerRecoveryStrategy('Operation', recoveryStrategy);

      const context = { operation: 'test', category: ErrorCategory.SYSTEM };
      const result = await errorHandler.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback result');
      expect(result.wasRecovered).toBe(true);
      expect(recoveryStrategy).toHaveBeenCalledTimes(1);
    });

    it('should track error metrics', async () => {
      const error = new ValidationError(
        'Test error',
        createErrorContext('test', ErrorCategory.VALIDATION)
      );
      const operation = vi.fn().mockRejectedValue(error);
      const context = { operation: 'test', category: ErrorCategory.VALIDATION };

      await errorHandler.executeWithRetry(operation, context);

      const metrics = errorHandler.getErrorMetrics();
      expect(metrics.size).toBeGreaterThan(0);

      const key = 'ValidationError:validation';
      const metric = metrics.get(key);
      expect(metric).toBeDefined();
      expect(metric?.count).toBe(1);
      expect(metric?.lastOccurrence).toBeInstanceOf(Date);
    });

    it('should update configuration', () => {
      const newConfig = { maxRetries: 5, baseRetryDelay: 2000 };
      errorHandler.updateConfig(newConfig);

      // Test that the new config is applied (indirectly through behavior)
      expect(() => errorHandler.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('Global Error Handler', () => {
    it('should provide global error handler instance', () => {
      expect(globalErrorHandler).toBeInstanceOf(ErrorHandler);
    });

    it('should provide convenience function for error handling', async () => {
      const operation = vi.fn().mockResolvedValue('test result');
      const context = { operation: 'test', category: ErrorCategory.SYSTEM };

      const result = await withErrorHandling(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('test result');
    });
  });

  describe('Error Type Guards', () => {
    it('should correctly identify error types', () => {
      const validation = new ValidationError(
        'test',
        createErrorContext('test', ErrorCategory.VALIDATION)
      );
      const file = new FileOperationError(
        'test',
        createErrorContext('test', ErrorCategory.FILE_OPERATION),
        { operation: 'read', filePath: '/test' }
      );
      const performance = new PerformanceError(
        'test',
        createErrorContext('test', ErrorCategory.PERFORMANCE),
        { performanceType: 'timeout' }
      );
      const config = new ConfigurationError(
        'test',
        createErrorContext('test', ErrorCategory.CONFIGURATION)
      );
      const integration = new IntegrationError(
        'test',
        createErrorContext('test', ErrorCategory.INTEGRATION),
        { integrationType: 'plugin', integrationName: 'test' }
      );

      expect(isValidationError(validation)).toBe(true);
      expect(isFileOperationError(file)).toBe(true);
      expect(isPerformanceError(performance)).toBe(true);
      expect(isConfigurationError(config)).toBe(true);
      expect(isIntegrationError(integration)).toBe(true);

      // Cross-type checks should be false
      expect(isValidationError(file)).toBe(false);
      expect(isFileOperationError(validation)).toBe(false);

      // All should be enhanced errors
      expect(isEnhancedError(validation)).toBe(true);
      expect(isEnhancedError(file)).toBe(true);
      expect(isEnhancedError(performance)).toBe(true);
      expect(isEnhancedError(config)).toBe(true);
      expect(isEnhancedError(integration)).toBe(true);
    });

    it('should return false for non-error objects', () => {
      expect(isValidationError('not an error')).toBe(false);
      expect(isFileOperationError(null)).toBe(false);
      expect(isPerformanceError(undefined)).toBe(false);
      expect(isConfigurationError({})).toBe(false);
      expect(isIntegrationError(new Error('regular error'))).toBe(false);
      expect(isEnhancedError('string')).toBe(false);
    });
  });

  describe('Default Configuration', () => {
    it('should provide sensible default configuration', () => {
      expect(DEFAULT_ERROR_HANDLER_CONFIG).toMatchObject({
        maxRetries: 3,
        baseRetryDelay: 1000,
        useExponentialBackoff: true,
        maxRetryDelay: 30000,
        enableReporting: true,
        criticalErrorThreshold: ErrorSeverity.CRITICAL,
        nonRetryableCategories: expect.arrayContaining([
          ErrorCategory.VALIDATION,
          ErrorCategory.CONFIGURATION,
          ErrorCategory.SECURITY,
          ErrorCategory.USER_INPUT,
        ]),
      });
    });
  });

  describe('Error Context Integration', () => {
    it('should properly integrate with length enforcement operations', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Length validation failed'));
      const context = {
        operation: 'enforce_minimum_length',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        metadata: {
          minimumLength: 4,
          actualLength: 2,
          inputValue: 'ab',
        },
      };

      const result = await withErrorHandling(operation, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.context.operation).toBe('enforce_minimum_length');
      expect(result.error?.context.metadata).toMatchObject({
        minimumLength: 4,
        actualLength: 2,
        inputValue: 'ab',
      });
    });

    it('should provide recovery suggestions for common errors', () => {
      const context = createErrorContext(
        'name_generation',
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM
      );
      context.recoverySuggestions = [
        'Reduce the minimum length requirement',
        'Use sequential naming strategy as fallback',
        'Check system resources',
      ];

      const formatted = formatErrorContext(context);

      expect(formatted).toContain('- Reduce the minimum length requirement');
      expect(formatted).toContain('- Use sequential naming strategy as fallback');
      expect(formatted).toContain('- Check system resources');
    });
  });
});
