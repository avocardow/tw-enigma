/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ErrorCategory,
  ErrorContext,
  ErrorSeverity,
  createErrorContext,
  enhanceErrorContext,
} from './ErrorContext';
import { EnhancedError, isEnhancedError } from './types';

/**
 * Configuration for error handling behavior
 */
export interface ErrorHandlerConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;

  /** Base delay between retries in milliseconds */
  baseRetryDelay: number;

  /** Whether to use exponential backoff for retries */
  useExponentialBackoff: boolean;

  /** Maximum delay between retries in milliseconds */
  maxRetryDelay: number;

  /** Whether to enable error reporting/logging */
  enableReporting: boolean;

  /** Threshold for critical errors that should not be retried */
  criticalErrorThreshold: ErrorSeverity;

  /** Categories of errors that should never be retried */
  nonRetryableCategories: ErrorCategory[];
}

/**
 * Default error handler configuration
 */
export const DEFAULT_ERROR_HANDLER_CONFIG: ErrorHandlerConfig = {
  maxRetries: 3,
  baseRetryDelay: 1000,
  useExponentialBackoff: true,
  maxRetryDelay: 30000,
  enableReporting: true,
  criticalErrorThreshold: ErrorSeverity.CRITICAL,
  nonRetryableCategories: [
    ErrorCategory.VALIDATION,
    ErrorCategory.CONFIGURATION,
    ErrorCategory.SECURITY,
    ErrorCategory.USER_INPUT,
  ],
};

/**
 * Result of an error handling operation
 */
export interface ErrorHandlingResult<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;

  /** The result value if successful */
  result?: T;

  /** The final error if unsuccessful */
  error?: EnhancedError;

  /** Number of attempts made */
  attempts: number;

  /** Total time spent in milliseconds */
  totalTime: number;

  /** Whether the operation was recovered through fallback */
  wasRecovered: boolean;

  /** Recovery method used, if any */
  recoveryMethod?: string;
}

/**
 * Retry strategy function type
 */
export type RetryStrategy<T> = (attempt: number, error: EnhancedError) => Promise<T>;

/**
 * Recovery strategy function type
 */
export type RecoveryStrategy<T> = (error: EnhancedError) => Promise<T>;

/**
 * Centralized error handler with retry logic and recovery strategies
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private recoveryStrategies = new Map<string, RecoveryStrategy<any>>();
  private errorMetrics = new Map<string, { count: number; lastOccurrence: Date }>();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_HANDLER_CONFIG, ...config };
  }

  /**
   * Execute an operation with error handling and retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext>,
    retryStrategy?: RetryStrategy<T>
  ): Promise<ErrorHandlingResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: EnhancedError | undefined;

    const fullContext = this.createFullContext(context);

    while (attempts < this.config.maxRetries) {
      attempts++;

      try {
        const result = await operation();
        return {
          success: true,
          result,
          attempts,
          totalTime: Date.now() - startTime,
          wasRecovered: false,
        };
      } catch (error) {
        lastError = this.enhanceError(error, fullContext);
        this.recordErrorMetric(lastError);

        // Check if error should not be retried
        if (!this.shouldRetry(lastError, attempts)) {
          break;
        }

        // Wait before retry with backoff
        if (attempts < this.config.maxRetries) {
          const delay = this.calculateRetryDelay(attempts, lastError);
          await this.sleep(delay);

          // Use custom retry strategy if provided
          if (retryStrategy) {
            try {
              const result = await retryStrategy(attempts, lastError);
              return {
                success: true,
                result,
                attempts,
                totalTime: Date.now() - startTime,
                wasRecovered: true,
                recoveryMethod: 'custom_retry_strategy',
              };
            } catch (retryError) {
              lastError = this.enhanceError(retryError, fullContext);
            }
          }
        }
      }
    }

    // All retries exhausted, try recovery strategies
    if (lastError) {
      const recoveryResult = await this.attemptRecovery(lastError);
      if (recoveryResult.success) {
        return {
          success: true,
          result: recoveryResult.result as T,
          attempts,
          totalTime: Date.now() - startTime,
          wasRecovered: true,
          recoveryMethod: recoveryResult.method,
        };
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalTime: Date.now() - startTime,
      wasRecovered: false,
    };
  }

  /**
   * Register a recovery strategy for specific error patterns
   */
  registerRecoveryStrategy<T>(
    pattern: string | RegExp | ((error: EnhancedError) => boolean),
    strategy: RecoveryStrategy<T>
  ): void {
    const key = typeof pattern === 'string' ? pattern : pattern.toString();
    this.recoveryStrategies.set(key, strategy);
  }

  /**
   * Get error metrics for monitoring
   */
  getErrorMetrics(): Map<string, { count: number; lastOccurrence: Date }> {
    return new Map(this.errorMetrics);
  }

  /**
   * Clear error metrics
   */
  clearErrorMetrics(): void {
    this.errorMetrics.clear();
  }

  /**
   * Update error handler configuration
   */
  updateConfig(updates: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Check if an error should be retried
   */
  private shouldRetry(error: EnhancedError, attempt: number): boolean {
    // Don't retry if max attempts reached
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    // Don't retry critical errors
    if (error.context.severity === this.config.criticalErrorThreshold) {
      return false;
    }

    // Don't retry non-retryable categories
    if (this.config.nonRetryableCategories.includes(error.context.category)) {
      return false;
    }

    // Use error's own retry logic
    return error.isRetryable();
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, error: EnhancedError): number {
    let delay = this.config.baseRetryDelay;

    if (this.config.useExponentialBackoff) {
      delay = delay * Math.pow(2, attempt - 1);
    }

    // Use error's suggested delay if available
    const errorDelay = error.getRetryDelay();
    if (errorDelay > 0) {
      delay = Math.max(delay, errorDelay);
    }

    // Cap at maximum delay
    delay = Math.min(delay, this.config.maxRetryDelay);

    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Attempt to recover from error using registered strategies
   */
  private async attemptRecovery<T>(error: EnhancedError): Promise<{
    success: boolean;
    result?: T;
    method?: string;
  }> {
    for (const [pattern, strategy] of this.recoveryStrategies) {
      try {
        // Check if strategy matches the error
        if (this.matchesRecoveryPattern(error, pattern)) {
          const result = await strategy(error);
          return { success: true, result, method: pattern };
        }
      } catch (recoveryError) {
        // Recovery strategy failed, continue to next one
        continue;
      }
    }

    return { success: false };
  }

  /**
   * Check if error matches a recovery pattern
   */
  private matchesRecoveryPattern(error: EnhancedError, pattern: string): boolean {
    // Simple string matching against error name or operation
    return (
      error.constructor.name.includes(pattern) ||
      error.context.operation.includes(pattern) ||
      error.message.includes(pattern)
    );
  }

  /**
   * Enhance an error with context if it's not already an EnhancedError
   */
  private enhanceError(error: unknown, context: ErrorContext): EnhancedError {
    if (isEnhancedError(error)) {
      return error;
    }

    const errorInstance = error instanceof Error ? error : new Error(String(error));

    // Create a generic enhanced error
    return new (class extends EnhancedError {})(
      errorInstance.message,
      enhanceErrorContext(context, {
        stackTrace: errorInstance.stack,
      }),
      errorInstance
    );
  }

  /**
   * Create full context from partial context
   */
  private createFullContext(partial: Partial<ErrorContext>): ErrorContext {
    return createErrorContext(
      partial.operation || 'unknown_operation',
      partial.category || ErrorCategory.SYSTEM,
      partial.severity || ErrorSeverity.MEDIUM,
      partial.metadata
    );
  }

  /**
   * Record error metric for monitoring
   */
  private recordErrorMetric(error: EnhancedError): void {
    const key = `${error.constructor.name}:${error.context.category}`;
    const existing = this.errorMetrics.get(key);

    this.errorMetrics.set(key, {
      count: (existing?.count || 0) + 1,
      lastOccurrence: new Date(),
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new ErrorHandler();

/**
 * Convenience function for executing operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: Partial<ErrorContext>
): Promise<ErrorHandlingResult<T>> {
  return globalErrorHandler.executeWithRetry(operation, context);
}
