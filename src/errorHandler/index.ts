/**
 * Error Handler Module - Comprehensive Error Handling for Tailwind Enigma Core
 * 
 * This module provides a complete error handling solution including:
 * - Circuit breaker pattern for resilient operations
 * - Centralized error handling with categorization
 * - Error recovery strategies and fallbacks
 * - Real-time analytics and health monitoring
 * - Event-driven error notification system
 * 
 * @example Basic Usage
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
export {
  ErrorHandler,
  getErrorHandler,
  handleError,
  type ErrorStats
} from './errorHandler.js';

// Circuit breaker components
export {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitBreakerOpenError,
  withCircuitBreaker
} from './circuitBreaker.js';

// Type definitions and utilities
export {
  // Enums
  ErrorSeverity,
  ErrorCategory,
  CircuitBreakerState,
  HealthStatus,
  
  // Interfaces
  type EnhancedErrorContext,
  type ErrorHandlerConfig,
  type ErrorRecoveryStrategy,
  type ErrorAnalytics,
  type CircuitBreakerMetrics,
  type CircuitBreakerFallback,
  type CircuitBreakerHealthStatus,
  
  // Utility functions
  categorizeError,
  severityToNumber,
  isEnigmaError
} from './types.js';

// Convenience re-exports for common use cases
export { createLogger } from '../logger.js';
export { EnigmaError } from '../errors.js';

import {
  ErrorHandlerConfig,
  ErrorSeverity,
  HealthStatus
} from './types.js';
import { ErrorHandler, getErrorHandler } from './errorHandler.js';
import { CircuitBreakerRegistry } from './circuitBreaker.js';

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
      [ErrorSeverity.LOW]: 50
    }
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
  let overall = HealthStatus.HEALTHY;
  
  if (analytics.systemHealth === HealthStatus.UNHEALTHY || 
      circuitHealth.unhealthy > circuitHealth.healthy) {
    overall = HealthStatus.UNHEALTHY;
  } else if (analytics.systemHealth === HealthStatus.DEGRADED || 
             circuitHealth.degraded > 0) {
    overall = HealthStatus.DEGRADED;
  }

  return {
    overall,
    errorHandler: analytics,
    circuitBreakers: circuitHealth,
    uptime: analytics.uptime,
    timestamp: new Date()
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