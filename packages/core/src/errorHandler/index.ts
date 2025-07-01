/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Error Handler Module - Comprehensive Error Handling for Tailwind Enigma Core
 *
 * This module provides a complete error handling solution including:
 * - Circuit breaker pattern for resilient operations
 * - Centralized error handling with categorization
 * - Error recovery strategies and fallbacks
 * - Real-time analytics and health monitoring
 * - Event-driven error notification system
 * - Enhanced error handling and logging system (Task 19)
 *
 * @example Basic Usage (Legacy)
 * ```typescript
 * import { handleError, getErrorHandler } from './errorHandler';
 *
 * try {
 *   // Some risky operation
 *   await riskyOperation();
 * } catch (error) {
 *   const shouldContinue = await handleError(error);
 *   if (!shouldContinue) {
 *     process.exit(1);
 *   }
 * }
 * ```
 *
 * @example New Centralized Error Handling
 * ```typescript
 * import { handleCentralizedError, ErrorCategory } from './errorHandler';
 *
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const recovered = await handleCentralizedError(error, {
 *     category: ErrorCategory.OPERATIONAL,
 *     operation: 'risky-operation',
 *     attemptRecovery: true
 *   });
 *   if (!recovered) {
 *     process.exit(1);
 *   }
 * }
 * ```
 *
 * @example Circuit Breaker Usage
 * ```typescript
 * import { CircuitBreakerRegistry } from './errorHandler';
 *
 * const circuit = CircuitBreakerRegistry.getInstance().getCircuit('api-calls');
 *
 * const result = await circuit.call(
 *   () => apiCall(),
 *   (error) => getCachedData() // fallback
 * );
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * import { ErrorHandler, ErrorSeverity, ErrorCategory } from './errorHandler';
 *
 * const errorHandler = ErrorHandler.getInstance({
 *   maxRetries: 3,
 *   retryDelay: 1000,
 *   exponentialBackoff: true,
 *   circuitBreakerEnabled: true,
 *   enableAnalytics: true,
 *   logLevel: 'info'
 * });
 *
 * errorHandler.on('error', (event) => {
 *   if (event.severity === ErrorSeverity.CRITICAL) {
 *     // Send alert to monitoring system
 *     sendAlert(event);
 *   }
 * });
 * ```
 */

// Core error handling components
export { ErrorHandler, getErrorHandler, handleError, type ErrorStats } from './errorHandler';

// Circuit breaker components
export {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  withCircuitBreaker,
} from './circuitBreaker';

// Type definitions and utilities
export {
  // Utility functions
  categorizeError,
  CircuitBreakerState,
  ErrorCategory,
  // Enums
  ErrorSeverity,
  HealthStatus,
  isEnigmaError,
  severityToNumber,
  type CircuitBreakerFallback,
  type CircuitBreakerHealthStatus,
  type CircuitBreakerMetrics,
  // Interfaces
  type EnhancedErrorContext,
  type ErrorAnalytics,
  type ErrorHandlerConfig,
  type ErrorRecoveryStrategy,
} from './types';

// Convenience re-exports for common use cases
export { EnigmaError } from '../utils/errors';
export { createLogger } from '../utils/logger';

import { CircuitBreakerRegistry } from './circuitBreaker';
import { ErrorHandler, getErrorHandler } from './errorHandler';
import { ErrorHandlerConfig, ErrorSeverity, HealthStatus } from './types';

/**
 * Initialize error handling with default configuration
 * Call this early in your application lifecycle
 *
 * @param config - Optional configuration overrides
 * @returns Configured ErrorHandler instance
 */
export function initializeErrorHandling(config?: Partial<ErrorHandlerConfig>) {
  const defaultConfig: ErrorHandlerConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
    circuitBreakerEnabled: true,
    enableAnalytics: true,
    logLevel: 'info',
    alertThresholds: {
      [ErrorSeverity.CRITICAL]: 1,
      [ErrorSeverity.HIGH]: 5,
      [ErrorSeverity.MEDIUM]: 10,
      [ErrorSeverity.LOW]: 50,
    },
  };

  return ErrorHandler.getInstance({ ...defaultConfig, ...config });
}

/**
 * Get system health status across all components
 *
 * @returns Overall system health information
 */
export function getSystemHealth() {
  const errorHandler = getErrorHandler();
  const circuitRegistry = CircuitBreakerRegistry.getInstance();
  const analytics = errorHandler.getAnalytics();
  const circuitHealth = circuitRegistry.getOverallHealth();

  // Determine overall health status
  let overall: HealthStatus = HealthStatus.HEALTHY;

  if (
    analytics.systemHealth === HealthStatus.UNHEALTHY ||
    circuitHealth.unhealthy > circuitHealth.healthy
  ) {
    overall = HealthStatus.UNHEALTHY;
  } else if (analytics.systemHealth === HealthStatus.DEGRADED || circuitHealth.degraded > 0) {
    overall = HealthStatus.DEGRADED;
  }

  return {
    overall,
    errorHandler: analytics,
    circuitBreakers: circuitHealth,
    uptime: analytics.uptime,
    timestamp: new Date(),
  };
}

/**
 * Gracefully shutdown error handling components
 * Call this during application shutdown
 */
export async function shutdownErrorHandling(): Promise<void> {
  try {
    const errorHandler = getErrorHandler();
    const circuitRegistry = CircuitBreakerRegistry.getInstance();

    // Stop processing new errors
    errorHandler.destroy();

    // Destroy all circuit breakers
    circuitRegistry.destroyAll();

    console.log('Error handling system shutdown complete');
  } catch (error) {
    console.error('Error during error handling shutdown:', error);
  }
}

// =============================================================================
// ENHANCED ERROR HANDLING SYSTEM EXPORTS (Task 19)
// =============================================================================

// Re-export all new error handling components
export * from './centralized';
export * from './userMessageSystem';
export * from './recoveryStrategies';
export * from './errorAggregator';
export * from './externalReporting';

// Convenience initialization functions for the new system
export {
  initializeCentralizedErrorHandling,
  handleCentralizedError,
  getCentralizedErrorHandler,
  shutdownCentralizedErrorHandling,
} from './centralized';

// Convenience logging functions
export {
  getGlobalStructuredLogger,
  createStructuredLogger,
} from '../utils/structuredLogger';

// Convenience user message functions
export {
  generateUserMessage,
  getUserMessageSystem,
} from './userMessageSystem';

// Convenience recovery functions
export {
  executeErrorRecovery,
  getRecoveryStrategies,
} from './recoveryStrategies';

// Convenience aggregation functions
export {
  aggregateError,
  getErrorAnalytics,
  getErrorAggregator,
} from './errorAggregator';

// Convenience external reporting functions
export {
  reportToExternal,
  addReportingBreadcrumb,
  getExternalReportingManager,
} from './externalReporting';
