/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Plugin Error Handling and Recovery System
 * Provides circuit breaker pattern, fallback mechanisms, and graceful degradation
 */

import { z } from "zod";
import { EventEmitter } from "events";
import { createLogger } from "../logger.ts";
import type {
  EnigmaPlugin,
  PluginConfig,
  PluginResult,
} from "../types/plugins.ts";

const logger = createLogger("plugin-error-handler");

/**
 * Error categories for classification
 */
export const PluginErrorCategory = {
  INITIALIZATION: "initialization",
  EXECUTION: "execution",
  TIMEOUT: "timeout",
  RESOURCE: "resource",
  CONFIGURATION: "configuration",
  DEPENDENCY: "dependency",
  SECURITY: "security",
  UNKNOWN: "unknown",
} as const;

export type PluginErrorCategory = typeof PluginErrorCategory[keyof typeof PluginErrorCategory];

/**
 * Error severity levels
 */
export const ErrorSeverity = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity];

/**
 * Circuit breaker states
 */
export const CircuitState = {
  CLOSED: "closed", // Normal operation
  OPEN: "open", // Failing fast
  HALF_OPEN: "half_open", // Testing recovery
} as const;

export type CircuitState = typeof CircuitState[keyof typeof CircuitState];

/**
 * Plugin error details
 */
export interface PluginError {
  pluginName: string;
  category: PluginErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, unknown>;
  retryCount: number;
  recoverable: boolean;
}

/**
 * Circuit breaker configuration
 */
export const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().min(1).max(50).default(5),
  resetTimeout: z.number().min(1000).max(300000).default(60000), // 1 minute
  monitoringPeriod: z.number().min(10000).max(600000).default(120000), // 2 minutes
  halfOpenMaxCalls: z.number().min(1).max(10).default(3),
  volumeThreshold: z.number().min(1).max(100).default(10),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

/**
 * Error handler configuration
 */
export const ErrorHandlerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(100).max(30000).default(1000),
  retryBackoffMultiplier: z.number().min(1).max(10).default(2),
  circuitBreaker: CircuitBreakerConfigSchema.default({}),
  gracefulDegradation: z.boolean().default(true),
  enableFallbacks: z.boolean().default(true),
  errorReporting: z.boolean().default(true),
  autoDisableThreshold: z.number().min(1).max(100).default(10),
  recoveryCooldown: z.number().min(30000).max(3600000).default(300000), // 5 minutes
});

export type ErrorHandlerConfig = z.infer<typeof ErrorHandlerConfigSchema>;

/**
 * Plugin health status
 */
export interface PluginHealth {
  pluginName: string;
  isHealthy: boolean;
  circuitState: CircuitState;
  errorCount: number;
  lastError?: PluginError;
  lastSuccess?: number;
  consecutiveFailures: number;
  totalCalls: number;
  successRate: number;
  averageResponseTime: number;
  isDisabled: boolean;
  disabledReason?: string;
}

/**
 * Fallback strategy interface
 */
export interface FallbackStrategy {
  pluginName: string;
  execute(): Promise<PluginResult | null>;
  canHandle(error: PluginError): boolean;
}

/**
 * Circuit breaker for individual plugins
 */
class PluginCircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;
  private callCount = 0;
  private successCount = 0;
  private totalResponseTime = 0;

  constructor(
    private pluginName: string,
    private config: CircuitBreakerConfig,
    private logger = createLogger(`circuit-breaker-${pluginName}`),
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCalls = 0;
        this.logger.info(
          `Circuit breaker half-opened for plugin ${this.pluginName}`,
        );
      } else {
        throw new Error(
          `Circuit breaker is OPEN for plugin ${this.pluginName}`,
        );
      }
    }

    if (
      this.state === CircuitState.HALF_OPEN &&
      this.halfOpenCalls >= this.config.halfOpenMaxCalls
    ) {
      throw new Error(
        `Circuit breaker half-open limit exceeded for plugin ${this.pluginName}`,
      );
    }

    this.callCount++;
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    const startTime = performance.now();

    try {
      const result = await operation();

      // Record success
      const responseTime = performance.now() - startTime;
      this.recordSuccess(responseTime);

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordSuccess(responseTime: number): void {
    this.successCount++;
    this.totalResponseTime += responseTime;

    if (this.state === CircuitState.HALF_OPEN) {
      // Reset circuit breaker on successful half-open call
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.logger.info(`Circuit breaker closed for plugin ${this.pluginName}`);
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during half-open, go back to open
      this.state = CircuitState.OPEN;
      this.logger.warn(
        `Circuit breaker reopened for plugin ${this.pluginName}`,
      );
    } else if (this.shouldOpenCircuit()) {
      this.state = CircuitState.OPEN;
      this.logger.error(
        `Circuit breaker opened for plugin ${this.pluginName}`,
        {
          failureCount: this.failureCount,
          threshold: this.config.failureThreshold,
        },
      );
    }
  }

  private shouldOpenCircuit(): boolean {
    return (
      this.callCount >= this.config.volumeThreshold &&
      this.failureCount >= this.config.failureThreshold
    );
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): {
    state: CircuitState;
    failureCount: number;
    callCount: number;
    successRate: number;
    averageResponseTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      callCount: this.callCount,
      successRate: this.callCount > 0 ? this.successCount / this.callCount : 1,
      averageResponseTime:
        this.successCount > 0 ? this.totalResponseTime / this.successCount : 0,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.callCount = 0;
    this.successCount = 0;
    this.totalResponseTime = 0;
    this.halfOpenCalls = 0;
    this.logger.info(`Circuit breaker reset for plugin ${this.pluginName}`);
  }
}

/**
 * Plugin error handler with circuit breaker and recovery
 */
export class PluginErrorHandler extends EventEmitter {
  private config: ErrorHandlerConfig;
  private circuitBreakers = new Map<string, PluginCircuitBreaker>();
  private pluginErrors = new Map<string, PluginError[]>();
  private fallbackStrategies = new Map<string, FallbackStrategy>();
  private disabledPlugins = new Set<string>();
  private pluginStats = new Map<string, PluginHealth>();
  private readonly logger = createLogger("plugin-error-handler");

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    super();
    this.config = ErrorHandlerConfigSchema.parse(config);

    this.logger.info("Plugin error handler initialized", {
      enabled: this.config.enabled,
      maxRetries: this.config.maxRetries,
      gracefulDegradation: this.config.gracefulDegradation,
    });

    // Start health monitoring
    if (this.config.enabled) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Execute plugin with error handling and circuit breaker
   */
  async executeWithErrorHandling<T>(
    pluginName: string,
    operation: () => Promise<T>,
    retryCount = 0,
  ): Promise<T | null> {
    if (!this.config.enabled) {
      return await operation();
    }

    if (this.disabledPlugins.has(pluginName)) {
      this.logger.warn(`Plugin ${pluginName} is disabled, skipping execution`);
      return await this.tryFallback(pluginName, {
        pluginName,
        category: PluginErrorCategory.EXECUTION,
        severity: ErrorSeverity.MEDIUM,
        message: "Plugin is disabled",
        timestamp: Date.now(),
        retryCount: 0,
        recoverable: false,
      });
    }

    const circuitBreaker = this.getCircuitBreaker(pluginName);

    try {
      const result = await circuitBreaker.execute(operation);
      this.recordSuccess(pluginName);
      return result;
    } catch (error) {
      const pluginError = this.createPluginError(pluginName, error, retryCount);
      this.recordError(pluginName, pluginError);

      // Check if we should retry
      if (this.shouldRetry(pluginError)) {
        this.logger.info(
          `Retrying plugin ${pluginName} (attempt ${retryCount + 1})`,
          {
            error: pluginError.message,
            delay: this.calculateRetryDelay(retryCount),
          },
        );

        await this.delay(this.calculateRetryDelay(retryCount));
        return await this.executeWithErrorHandling(
          pluginName,
          operation,
          retryCount + 1,
        );
      }

      // Try fallback strategy
      const fallback = this.fallbackStrategies.get(pluginName);
      if (this.config.enableFallbacks && fallback) {
        this.logger.warn(`Executing fallback for plugin ${pluginName}`, {
          originalError: error instanceof Error ? error.message : String(error),
        });

        try {
          const fallbackResult = await fallback.execute();
          this.recordFallbackExecution(pluginName, "success");
          return fallbackResult as T;
        } catch (fallbackError) {
          this.recordFallbackExecution(pluginName, "failure");
          this.logger.error(
            `Fallback execution failed for plugin ${pluginName}`,
            {
              error:
                fallbackError instanceof Error
                  ? fallbackError.message
                  : String(fallbackError),
            },
          );
        }
      }

      // Check if plugin should be disabled
      if (this.shouldDisablePlugin(pluginName)) {
        this.disablePlugin(pluginName, "Too many failures");
      }

      if (this.config.gracefulDegradation) {
        this.logger.warn(
          `Plugin ${pluginName} failed, continuing with graceful degradation`,
          {
            error: pluginError,
          },
        );
        return null;
      }

      throw error;
    }
  }

  /**
   * Register fallback strategy for plugin
   */
  registerFallback(pluginName: string, strategy: FallbackStrategy): void {
    this.fallbackStrategies.set(pluginName, strategy);
    this.logger.debug(`Registered fallback strategy for plugin ${pluginName}`);
  }

  /**
   * Get plugin health status
   */
  getPluginHealth(pluginName: string): PluginHealth {
    const stats = this.pluginStats.get(pluginName);
    const circuitBreaker = this.circuitBreakers.get(pluginName);
    const isDisabled = this.disabledPlugins.has(pluginName);

    if (!stats) {
      return {
        pluginName,
        isHealthy: true,
        circuitState: CircuitState.CLOSED,
        errorCount: 0,
        consecutiveFailures: 0,
        totalCalls: 0,
        successRate: 1,
        averageResponseTime: 0,
        isDisabled,
      };
    }

    // Calculate health based on error count, circuit breaker state, and disabled status
    const circuitState = circuitBreaker?.getState() || CircuitState.CLOSED;
    const isHealthy =
      stats.errorCount === 0 &&
      !isDisabled &&
      circuitState === CircuitState.CLOSED;

    return {
      ...stats,
      isHealthy,
      circuitState,
      isDisabled,
    };
  }

  /**
   * Get all plugin health stats
   */
  getAllPluginHealth(): PluginHealth[] {
    const allPlugins = new Set([
      ...this.pluginStats.keys(),
      ...this.circuitBreakers.keys(),
    ]);

    return Array.from(allPlugins).map((pluginName) =>
      this.getPluginHealth(pluginName),
    );
  }

  /**
   * Manually disable plugin
   */
  disablePlugin(pluginName: string, reason: string): void {
    this.disabledPlugins.add(pluginName);

    const health = this.getPluginHealth(pluginName);
    health.isDisabled = true;
    health.disabledReason = reason;
    this.pluginStats.set(pluginName, health);

    this.logger.warn(`Plugin ${pluginName} disabled`, { reason });
    this.emit("pluginDisabled", { pluginName, reason });
  }

  /**
   * Re-enable plugin
   */
  enablePlugin(pluginName: string): void {
    this.disabledPlugins.delete(pluginName);

    // Reset circuit breaker
    const circuitBreaker = this.circuitBreakers.get(pluginName);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }

    // Reset stats
    const health = this.getPluginHealth(pluginName);
    health.isDisabled = false;
    health.disabledReason = undefined;
    health.isHealthy = true;
    health.consecutiveFailures = 0;
    this.pluginStats.set(pluginName, health);

    this.logger.info(`Plugin ${pluginName} re-enabled`);
    this.emit("pluginEnabled", { pluginName });
  }

  /**
   * Reset plugin statistics (for cleanup)
   */
  resetPluginStats(pluginName: string): void {
    this.pluginErrors.delete(pluginName);
    this.circuitBreakers.delete(pluginName);
    this.logger.debug(`Reset plugin statistics for ${pluginName}`);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.circuitBreakers.clear();
    this.pluginErrors.clear();
    this.fallbackStrategies.clear();
    this.disabledPlugins.clear();
    this.pluginStats.clear();

    this.logger.info("Plugin error handler cleanup completed");
  }

  /**
   * Private: Get or create circuit breaker
   */
  private getCircuitBreaker(pluginName: string): PluginCircuitBreaker {
    if (!this.circuitBreakers.has(pluginName)) {
      this.circuitBreakers.set(
        pluginName,
        new PluginCircuitBreaker(pluginName, this.config.circuitBreaker),
      );
    }
    return this.circuitBreakers.get(pluginName)!;
  }

  /**
   * Private: Create plugin error from exception
   */
  private createPluginError(
    pluginName: string,
    error: unknown,
    retryCount: number,
  ): PluginError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    return {
      pluginName,
      category: this.categorizeError(error),
      severity: this.assessErrorSeverity(error, retryCount),
      message: errorMessage,
      stack: errorStack,
      timestamp: Date.now(),
      context: { retryCount },
      retryCount,
      recoverable: this.isErrorRecoverable(error),
    };
  }

  /**
   * Private: Categorize error type
   */
  private categorizeError(error: unknown): PluginErrorCategory {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes("timeout")) return PluginErrorCategory.TIMEOUT;
      if (message.includes("memory") || message.includes("resource"))
        return PluginErrorCategory.RESOURCE;
      if (message.includes("config") || message.includes("option"))
        return PluginErrorCategory.CONFIGURATION;
      if (message.includes("dependency") || message.includes("require"))
        return PluginErrorCategory.DEPENDENCY;
      if (message.includes("security") || message.includes("permission"))
        return PluginErrorCategory.SECURITY;
      if (message.includes("init")) return PluginErrorCategory.INITIALIZATION;
    }

    return PluginErrorCategory.EXECUTION;
  }

  /**
   * Private: Assess error severity
   */
  private assessErrorSeverity(
    error: unknown,
    retryCount: number,
  ): ErrorSeverity {
    if (retryCount >= this.config.maxRetries) return ErrorSeverity.HIGH;

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes("fatal") || message.includes("critical"))
        return ErrorSeverity.CRITICAL;
      if (message.includes("security") || message.includes("memory"))
        return ErrorSeverity.HIGH;
      if (message.includes("timeout") || message.includes("network"))
        return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  /**
   * Private: Check if error is recoverable
   */
  private isErrorRecoverable(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Non-recoverable errors
      if (message.includes("security") || message.includes("malicious"))
        return false;
      if (message.includes("invalid syntax") || message.includes("parse error"))
        return false;
      if (message.includes("out of memory")) return false;

      // Recoverable errors
      if (message.includes("timeout") || message.includes("network"))
        return true;
      if (message.includes("temporary") || message.includes("retry"))
        return true;
    }

    return true; // Default to recoverable
  }

  /**
   * Private: Record successful execution
   */
  private recordSuccess(pluginName: string): void {
    const health = this.getPluginHealth(pluginName);
    health.totalCalls++;
    health.consecutiveFailures = 0;
    health.isHealthy = true;
    health.lastSuccess = Date.now();

    // Update success rate
    const circuitBreaker = this.circuitBreakers.get(pluginName);
    if (circuitBreaker) {
      const stats = circuitBreaker.getStats();
      health.successRate = stats.successRate;
      health.averageResponseTime = stats.averageResponseTime;
      health.circuitState = stats.state;
    }

    this.pluginStats.set(pluginName, health);
  }

  /**
   * Private: Record error occurrence
   */
  private recordError(pluginName: string, error: PluginError): void {
    // Store error
    if (!this.pluginErrors.has(pluginName)) {
      this.pluginErrors.set(pluginName, []);
    }

    const errors = this.pluginErrors.get(pluginName)!;
    errors.push(error);

    // Keep only recent errors (last 100)
    if (errors.length > 100) {
      errors.splice(0, errors.length - 100);
    }

    // Update health stats
    const health = this.getPluginHealth(pluginName);
    health.errorCount++;
    health.consecutiveFailures++;
    health.lastError = error;
    health.isHealthy =
      health.consecutiveFailures < this.config.autoDisableThreshold;

    // Update circuit breaker state
    const circuitBreaker = this.circuitBreakers.get(pluginName);
    if (circuitBreaker) {
      health.circuitState = circuitBreaker.getState();
    }

    this.pluginStats.set(pluginName, health);

    // Emit error event
    this.emit("pluginError", error);

    if (this.config.errorReporting) {
      this.logger.error(`Plugin ${pluginName} error`, {
        category: error.category,
        severity: error.severity,
        message: error.message,
        retryCount: error.retryCount,
      });
    }
  }

  /**
   * Private: Check if should retry
   */
  private shouldRetry(error: PluginError): boolean {
    return (
      error.retryCount < this.config.maxRetries &&
      error.recoverable &&
      error.severity !== ErrorSeverity.CRITICAL
    );
  }

  /**
   * Private: Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    return (
      this.config.retryDelay *
      Math.pow(this.config.retryBackoffMultiplier, retryCount)
    );
  }

  /**
   * Private: Try fallback strategy
   */
  private async tryFallback<T>(
    pluginName: string,
    error: PluginError,
  ): Promise<T | null> {
    if (!this.config.enableFallbacks) {
      return null;
    }

    const fallback = this.fallbackStrategies.get(pluginName);
    if (!fallback || !fallback.canHandle(error)) {
      return null;
    }

    try {
      this.logger.info(`Executing fallback for plugin ${pluginName}`);
      const result = await fallback.execute();
      this.emit("fallbackExecuted", { pluginName, error });
      return result as T;
    } catch (fallbackError) {
      this.logger.error(`Fallback failed for plugin ${pluginName}`, {
        fallbackError,
      });
      return null;
    }
  }

  /**
   * Private: Check if plugin should be disabled
   */
  private shouldDisablePlugin(pluginName: string): boolean {
    const health = this.getPluginHealth(pluginName);
    return health.consecutiveFailures >= this.config.autoDisableThreshold;
  }

  /**
   * Private: Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      for (const [pluginName, health] of this.pluginStats) {
        // Check for recovery opportunities
        if (health.isDisabled && health.lastError) {
          const timeSinceLastError = Date.now() - health.lastError.timestamp;
          if (timeSinceLastError > this.config.recoveryCooldown) {
            this.logger.info(`Attempting recovery for plugin ${pluginName}`);
            this.enablePlugin(pluginName);
          }
        }
      }
    }, this.config.circuitBreaker.monitoringPeriod);
  }

  /**
   * Private: Record fallback execution for metrics
   */
  private recordFallbackExecution(
    pluginName: string,
    result: "success" | "failure",
  ): void {
    const health = this.getPluginHealth(pluginName);
    // Update fallback metrics if needed
    this.pluginStats.set(pluginName, health);
  }

  /**
   * Private: Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create default error handler configuration
 */
export function createDefaultErrorHandlerConfig(): ErrorHandlerConfig {
  return ErrorHandlerConfigSchema.parse({});
}

/**
 * Create plugin error handler instance
 */
export function createPluginErrorHandler(
  config?: Partial<ErrorHandlerConfig>,
): PluginErrorHandler {
  return new PluginErrorHandler(config);
}
