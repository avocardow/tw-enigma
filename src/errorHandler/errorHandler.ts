/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Centralized Error Handler for Tailwind Enigma Core
 * Coordinates error categorization, circuit breaker integration, and recovery strategies
 */

import { EventEmitter } from "events";
import { createLogger } from "../logger.ts";
import { CircuitBreakerRegistry } from "./circuitBreaker.ts";
import {
  ErrorSeverity,
  ErrorCategory,
  EnhancedErrorContext,
  ErrorHandlerConfig,
  ErrorRecoveryStrategy,
  ErrorAnalytics,
  HealthStatus,
  isEnigmaError,
  categorizeError,
  severityToNumber,
} from "./types.ts";

/**
 * Error handling statistics for monitoring
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  lastError?: {
    timestamp: Date;
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
  };
  recoveryAttempts: number;
  successfulRecoveries: number;
}

/**
 * Default error handler configuration
 */
const DEFAULT_ERROR_CONFIG: ErrorHandlerConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
  circuitBreakerEnabled: true,
  enableAnalytics: true,
  logLevel: "error",
  alertThresholds: {
    [ErrorSeverity.CRITICAL]: 1,
    [ErrorSeverity.HIGH]: 5,
    [ErrorSeverity.MEDIUM]: 10,
    [ErrorSeverity.LOW]: 50,
  },
};

/**
 * Centralized Error Handler - Singleton pattern
 */
export class ErrorHandler extends EventEmitter {
  private static instance: ErrorHandler;
  private readonly logger = createLogger("ErrorHandler");
  private readonly circuitRegistry = CircuitBreakerRegistry.getInstance();
  private readonly config: ErrorHandlerConfig;
  private readonly errorStats: ErrorStats = {
    totalErrors: 0,
    errorsByCategory: {
      [ErrorCategory.OPERATIONAL]: 0,
      [ErrorCategory.PROGRAMMING]: 0,
      [ErrorCategory.EXTERNAL_SERVICE]: 0,
      [ErrorCategory.CONFIGURATION]: 0,
      [ErrorCategory.RESOURCE]: 0,
      [ErrorCategory.VALIDATION]: 0,
    },
    errorsBySeverity: {
      [ErrorSeverity.CRITICAL]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.LOW]: 0,
    },
    recoveryAttempts: 0,
    successfulRecoveries: 0,
  };

  private constructor(config: Partial<ErrorHandlerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ERROR_CONFIG, ...config };

    this.logger.info("Error handler initialized", {
      config: this.config,
      timestamp: new Date(),
    });

    // Set up global error handlers
    this.setupGlobalHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config);
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle an error with full categorization and recovery
   */
  async handleError(
    error: Error,
    context?: EnhancedErrorContext,
    recoveryStrategy?: ErrorRecoveryStrategy,
  ): Promise<boolean> {
    // Enhance context with error handler metadata
    const enhancedContext: EnhancedErrorContext = {
      timestamp: new Date(),
      component: "ErrorHandler",
      operationId: `error-${Date.now()}`,
      ...context,
    };

    // Categorize the error
    const category = categorizeError(error);
    const severity = this.determineSeverity(error, category);

    // Update statistics
    this.updateStats(error, category, severity);

    // Log the error
    await this.logError(error, category, severity, enhancedContext);

    // Check if we should trigger circuit breaker
    if (this.shouldUseCircuitBreaker(category, severity)) {
      return this.handleWithCircuitBreaker(
        error,
        enhancedContext,
        recoveryStrategy,
      );
    }

    // Attempt recovery if strategy provided
    if (recoveryStrategy) {
      return this.attemptRecovery(error, enhancedContext, recoveryStrategy);
    }

    // Emit error event for external handling
    this.emit("error", {
      error,
      category,
      severity,
      context: enhancedContext,
      timestamp: new Date(),
    });

    // Determine if this is a fatal error
    return !this.isFatalError(severity, category);
  }

  /**
   * Handle error with circuit breaker protection
   */
  private async handleWithCircuitBreaker(
    error: Error,
    context: EnhancedErrorContext,
    recoveryStrategy?: ErrorRecoveryStrategy,
  ): Promise<boolean> {
    const circuitName = context.component || "default";
    const circuit = this.circuitRegistry.getCircuit(circuitName);

    try {
      // Use circuit breaker for recovery attempts
      if (recoveryStrategy) {
        await circuit.call(
          () => this.executeRecoveryStrategy(recoveryStrategy, error, _context),
          undefined, // No fallback for recovery attempts
          context,
        );
        return true;
      }

      return false;
    } catch (circuitError) {
      this.logger.error("Circuit breaker blocked recovery attempt", {
        originalError: error.message,
        circuitError:
          circuitError instanceof Error
            ? circuitError.message
            : String(circuitError),
        circuitName,
        context,
      });
      return false;
    }
  }

  /**
   * Attempt error recovery using the provided strategy
   */
  private async attemptRecovery(
    error: Error,
    context: EnhancedErrorContext,
    strategy: ErrorRecoveryStrategy,
  ): Promise<boolean> {
    this.errorStats.recoveryAttempts++;

    try {
      const result = await this.executeRecoveryStrategy(
        strategy,
        error,
        context,
      );

      if (result) {
        this.errorStats.successfulRecoveries++;
        this.logger.info("Error recovery successful", {
          error: error.message,
          strategy: strategy.type,
          attempts: this.errorStats.recoveryAttempts,
          context,
        });

        this.emit("recovery", {
          error,
          strategy,
          context,
          success: true,
          timestamp: new Date(),
        });

        return true;
      }
    } catch (recoveryError) {
      this.logger.error("Error recovery failed", {
        originalError: error.message,
        recoveryError: (recoveryError as Error).message,
        strategy: strategy.type,
        context,
      });

      this.emit("recovery", {
        error,
        strategy,
        context,
        success: false,
        recoveryError: recoveryError as Error,
        timestamp: new Date(),
      });
    }

    return false;
  }

  /**
   * Execute a specific recovery strategy
   */
  private async executeRecoveryStrategy(
    strategy: ErrorRecoveryStrategy,
    error: Error,
    context: EnhancedErrorContext,
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      switch (strategy.type) {
        case "retry":
          return await this.executeRetryStrategy(strategy, error, _context);

        case "fallback":
          return await this.executeFallbackStrategy(strategy, error, _context);

        case "circuit-breaker":
          // Circuit breaker is handled at a higher level
          return false;

        case "graceful-degradation":
          return await this.executeGracefulDegradationStrategy(
            strategy,
            error,
            context,
          );

        default:
          this.logger.warn("Unknown recovery strategy", {
            strategy: strategy.type,
            error: error.message,
            context,
          });
          return false;
      }
    } finally {
      const duration = Date.now() - startTime;
      this.logger.debug("Recovery strategy execution completed", {
        strategy: strategy.type,
        duration,
        context,
      });
    }
  }

  /**
   * Execute retry recovery strategy
   */
  private async executeRetryStrategy(
    strategy: ErrorRecoveryStrategy,
    error: Error,
    context: EnhancedErrorContext,
  ): Promise<boolean> {
    const maxRetries = strategy.config?.maxRetries || this.config.maxRetries;
    const baseDelay = strategy.config?.retryDelay || this.config.retryDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug("Retry attempt", {
          attempt,
          maxRetries,
          error: error.message,
          context,
        });

        // If the strategy has an action, execute it
        if (strategy.action) {
          await strategy.action();
          return true;
        }

        // Default retry behavior - wait and return true to indicate retry should be attempted
        const delay = this.config.exponentialBackoff
          ? baseDelay * Math.pow(2, attempt - 1)
          : baseDelay;

        await this.sleep(delay);
        return true;
      } catch (retryError) {
        this.logger.warn("Retry attempt failed", {
          attempt,
          maxRetries,
          error: (retryError as Error).message,
          context,
        });

        if (attempt === maxRetries) {
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Execute fallback recovery strategy
   */
  private async executeFallbackStrategy(
    strategy: ErrorRecoveryStrategy,
    error: Error,
    context: EnhancedErrorContext,
  ): Promise<boolean> {
    this.logger.info("Executing fallback strategy", {
      error: error.message,
      fallback: strategy.config?.fallbackAction,
      context,
    });

    try {
      if (strategy.action) {
        await strategy.action();
        return true;
      }

      // Default fallback behavior
      return true;
    } catch (fallbackError) {
      this.logger.error("Fallback strategy failed", {
        error: error.message,
        fallbackError: (fallbackError as Error).message,
        context,
      });
      return false;
    }
  }

  /**
   * Execute graceful degradation strategy
   */
  private async executeGracefulDegradationStrategy(
    strategy: ErrorRecoveryStrategy,
    error: Error,
    context: EnhancedErrorContext,
  ): Promise<boolean> {
    this.logger.info("Executing graceful degradation", {
      error: error.message,
      degradationLevel: strategy.config?.degradationLevel,
      context,
    });

    // Emit degradation event for other components to handle
    this.emit("degradation", {
      error,
      level: strategy.config?.degradationLevel || "partial",
      context,
      timestamp: new Date(),
    });

    // Graceful degradation always succeeds by design
    return true;
  }

  /**
   * Determine error severity based on error type and category
   */
  private determineSeverity(
    error: Error,
    category: ErrorCategory,
  ): ErrorSeverity {
    // Check if it's an EnigmaError with explicit severity
    if (isEnigmaError(error) && error.severity) {
      return error.severity;
    }

    // Determine severity based on category and error type
    switch (category) {
      case ErrorCategory.PROGRAMMING:
        return ErrorSeverity.HIGH;

      case ErrorCategory.CONFIGURATION:
        return ErrorSeverity.MEDIUM;

      case ErrorCategory.EXTERNAL_SERVICE:
        return ErrorSeverity.MEDIUM;

      case ErrorCategory.RESOURCE:
        return error.message.includes("memory") ||
          error.message.includes("disk")
          ? ErrorSeverity.HIGH
          : ErrorSeverity.MEDIUM;

      case ErrorCategory.VALIDATION:
        return ErrorSeverity.LOW;

      case ErrorCategory.OPERATIONAL:
      default:
        // Check for critical operational errors
        if (
          error.message.includes("ENOENT") ||
          error.message.includes("permission denied") ||
          error.message.includes("network")
        ) {
          return ErrorSeverity.HIGH;
        }
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Determine if circuit breaker should be used for this error
   */
  private shouldUseCircuitBreaker(
    category: ErrorCategory,
    severity: ErrorSeverity,
  ): boolean {
    if (!this.config.circuitBreakerEnabled) {
      return false;
    }

    // Use circuit breaker for external services and high-severity operational errors
    return (
      category === ErrorCategory.EXTERNAL_SERVICE ||
      (category === ErrorCategory.OPERATIONAL &&
        severity === ErrorSeverity.HIGH) ||
      severity === ErrorSeverity.CRITICAL
    );
  }

  /**
   * Check if error is fatal and should terminate the process
   */
  private isFatalError(
    severity: ErrorSeverity,
    category: ErrorCategory,
  ): boolean {
    return (
      severity === ErrorSeverity.CRITICAL ||
      (category === ErrorCategory.PROGRAMMING &&
        severity === ErrorSeverity.HIGH)
    );
  }

  /**
   * Log error with appropriate level and context
   */
  private async logError(
    error: Error,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: EnhancedErrorContext,
  ): Promise<void> {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      category,
      severity,
      severityNumber: severityToNumber(severity),
      context,
      timestamp: new Date(),
    };

    // Log at appropriate level based on severity
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.fatal("Critical error occurred", logData);
        break;

      case ErrorSeverity.HIGH:
        this.logger.error("High severity error occurred", logData);
        break;

      case ErrorSeverity.MEDIUM:
        this.logger.warn("Medium severity error occurred", logData);
        break;

      case ErrorSeverity.LOW:
        this.logger.info("Low severity error occurred", logData);
        break;
    }

    // Check alert thresholds
    await this.checkAlertThresholds(severity, category);
  }

  /**
   * Update error statistics
   */
  private updateStats(
    error: Error,
    category: ErrorCategory,
    severity: ErrorSeverity,
  ): void {
    this.errorStats.totalErrors++;
    this.errorStats.errorsByCategory[category]++;
    this.errorStats.errorsBySeverity[severity]++;

    this.errorStats.lastError = {
      timestamp: new Date(),
      category,
      severity,
      message: error.message,
    };
  }

  /**
   * Check if error count exceeds alert thresholds
   */
  private async checkAlertThresholds(
    severity: ErrorSeverity,
    category: ErrorCategory,
  ): Promise<void> {
    const threshold = this.config.alertThresholds?.[severity];
    const currentCount = this.errorStats.errorsBySeverity[severity];

    if (threshold && currentCount >= threshold) {
      this.emit("alert", {
        severity,
        category,
        currentCount,
        threshold,
        stats: this.getStats(),
        timestamp: new Date(),
      });

      this.logger.warn("Error threshold exceeded", {
        severity,
        category,
        currentCount,
        threshold,
      });
    }
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    // Handle uncaught exceptions
    process.on("uncaughtException", async (error) => {
      this.logger.fatal("Uncaught exception", {
        error: error.message,
        stack: error.stack,
      });

      await this.handleError(error, {
        component: "UncaughtExceptionHandler",
        operationId: "global-uncaught-exception",
      });

      // Give time for cleanup, then exit
      setTimeout(() => process.exit(1), 1000);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", async (reason, promise) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));

      this.logger.error("Unhandled promise rejection", {
        error: error.message,
        stack: error.stack,
        promise: promise.toString(),
      });

      await this.handleError(error, {
        component: "UnhandledRejectionHandler",
        operationId: "global-unhandled-rejection",
      });
    });

    this.logger.debug("Global error handlers registered");
  }

  /**
   * Get current error statistics
   */
  getStats(): ErrorStats {
    return { ...this.errorStats };
  }

  /**
   * Get error analytics data
   */
  getAnalytics(): ErrorAnalytics {
    const now = Date.now();
    const stats = this.getStats();
    const circuitMetrics = this.circuitRegistry.getAllMetrics();
    const circuitHealth = this.circuitRegistry.getOverallHealth();

    return {
      totalErrors: stats.totalErrors,
      errorsByCategory: stats.errorsByCategory,
      errorsBySeverity: stats.errorsBySeverity,
      recoveryRate:
        stats.recoveryAttempts > 0
          ? (stats.successfulRecoveries / stats.recoveryAttempts) * 100
          : 100,
      lastErrorTime: stats.lastError?.timestamp || null,
      circuitBreakerMetrics: circuitMetrics,
      systemHealth: this.calculateSystemHealth(stats, circuitHealth),
      uptime: now,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate overall system health
   */
  private calculateSystemHealth(
    stats: ErrorStats,
    circuitHealth: {
      healthy: number;
      degraded: number;
      unhealthy: number;
      total: number;
    },
  ): HealthStatus {
    // If we have critical errors or many circuit breakers are unhealthy
    if (
      stats.errorsBySeverity[ErrorSeverity.CRITICAL] > 0 ||
      circuitHealth.unhealthy > circuitHealth.total / 2
    ) {
      return HealthStatus.UNHEALTHY;
    }

    // If we have degraded circuits or high severity errors
    if (
      circuitHealth.degraded > 0 ||
      stats.errorsBySeverity[ErrorSeverity.HIGH] > 5
    ) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Reset error statistics
   */
  resetStats(): void {
    this.errorStats.totalErrors = 0;
    Object.keys(this.errorStats.errorsByCategory).forEach((key) => {
      this.errorStats.errorsByCategory[key as ErrorCategory] = 0;
    });
    Object.keys(this.errorStats.errorsBySeverity).forEach((key) => {
      this.errorStats.errorsBySeverity[key as ErrorSeverity] = 0;
    });
    this.errorStats.recoveryAttempts = 0;
    this.errorStats.successfulRecoveries = 0;
    delete this.errorStats.lastError;

    this.logger.info("Error statistics reset");
  }

  /**
   * Utility function to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources when error handler is destroyed
   */
  destroy(): void {
    this.circuitRegistry.destroyAll();
    this.removeAllListeners();

    this.logger.info("Error handler destroyed");
  }
}

/**
 * Convenience function to get the global error handler instance
 */
export function getErrorHandler(
  config?: Partial<ErrorHandlerConfig>,
): ErrorHandler {
  return ErrorHandler.getInstance(config);
}

/**
 * Convenience function to handle an error through the global error handler
 */
export async function handleError(
  error: Error,
  context?: EnhancedErrorContext,
  recoveryStrategy?: ErrorRecoveryStrategy,
): Promise<boolean> {
  const handler = ErrorHandler.getInstance();
  return handler.handleError(error, context, recoveryStrategy);
}
